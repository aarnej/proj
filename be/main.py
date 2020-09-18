import uwsgi
from urllib.parse import parse_qs
from http.cookies import SimpleCookie
import psycopg2
import jwt
import json
import base64
import os
from datetime import datetime, timezone, timedelta

with open('.jwt_secret') as f:
    JWT_SECRET = base64.b64decode(f.read())

connection = psycopg2.connect(database = "web", port = "5433")

def access_token(user_id):
    return jwt.encode({
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(minutes=5),
        'aud': 'urn:access',
    }, JWT_SECRET, algorithm='HS256').decode()


def refresh(env, start_response):
    try:
        refresh_token = SimpleCookie(env.get('HTTP_COOKIE')).get('refresh_token')
        if refresh_token:
            data = jwt.decode(refresh_token.value, JWT_SECRET, algorithm='HS256',
                              options={'require': ['exp', 'aud']},
                              audience='urn:refresh')

            if parse_qs(env.get('QUERY_STRING')).get('logout'):
                start_response('200 OK', [
                    ('Set-Cookie',
                     'refresh_token=; Max-Age=0; Secure; '
                     'HttpOnly; SameSite=Strict; Path=/api'),
                ])
                return []

            start_response('200 OK', [
                ('Content-Type','application/json'),
            ])
            return [json.dumps({
                'access_token': access_token(data['user_id']),
            }).encode()]
    except jwt.PyJWTError:
        pass

    return unauthorized(env, start_response)


def access_token_from_env(env):
    try:
        return env['HTTP_AUTHORIZATION'].split()[-1]
    except (IndexError, KeyError):
        return None


def decode_access_token(token):
    try:
        payload = jwt.decode(token,
                             JWT_SECRET,
                             algorithm='HS256',
                             options={'require': ['exp', 'aud']},
                             audience='urn:access')
    except jwt.PyJWTError:
        return None

    return payload['user_id']


def login(env, start_response):
    payload = json.load(env['wsgi.input'])
    with connection, connection.cursor() as cursor:
        cursor.execute(
            'select id from users where username = %s and password = crypt(%s, password);',
            (payload['username'], payload['password'])
        )
        (user_id,) = cursor.fetchone() or (None,)

    if user_id:
        refresh_token = jwt.encode({
            'user_id': user_id,
            'exp': datetime.now(timezone.utc) + timedelta(hours=3),
            'aud': 'urn:refresh',
        }, JWT_SECRET, algorithm='HS256').decode()

        start_response('200 OK', [
            ('Content-Type','application/json'),
            ('Set-Cookie', f'refresh_token={refresh_token}; Secure; '
             f'HttpOnly; SameSite=Strict; Path=/api; Max-Age={60*60*24*365}'),
        ])
        return [json.dumps({
            'access_token': access_token(user_id),
        }).encode()]

    return unauthorized(env, start_response)


def unknown(env, start_response):
    start_response('404 Not Found', [])
    return []


def unauthorized(env, start_response):
    start_response('403 Forbidden', [])
    return []


def words(env, start_response, user_id):
    qs = parse_qs(env.get('QUERY_STRING'))
    offset = int(qs.get('offset', [0])[0])
    limit = int(qs.get('limit', [7])[0])

    with connection, connection.cursor() as cursor:
        cursor.execute(
            '''
            select lang_a, lang_b, lang_b.id
            from lang_a
            join lang_b on lang_b.lang_a_id = lang_a.id
            order by lang_a
            offset %s
            limit %s
            ''',
            (offset, limit),
        )
        words = cursor.fetchmany(limit)
        cursor.execute(
            '''
            select count(id)
            from lang_a
            ''',
            (offset, limit),
        )
        count = cursor.fetchone()[0]

    start_response('200 OK', [
        ('Content-Type', 'application/json'),
    ])
    return [json.dumps({
        'count': count,
        'offset': offset,
        'limit': limit,
        'words': words,
    }).encode()]


def quiz(env, start_response, user_id):
    req_date = parse_qs(env.get('QUERY_STRING')).get('date')

    prev_idx = None
    curr_idx = None
    next_idx = None

    with connection, connection.cursor() as cursor:
        if req_date:
            cursor.execute(
                '''
                select extract(epoch from date)
                from quizzes
                where user_id = %s and extract(epoch from date) < %s
                order by date desc
                limit 1
                ''',
                (user_id, req_date[0])
            )
            res = cursor.fetchmany(1)
            prev_date = res and res[0][0] or None

            cursor.execute(
                '''
                select id, extract(epoch from date)
                from quizzes
                where user_id = %s and extract(epoch from date) >= %s
                order by date
                limit %s
                ''',
                (user_id, prev_date or req_date[0], prev_date and 3 or 2)
            )

            quizzes = cursor.fetchmany(3);
            if len(quizzes) == 3:
                prev_idx = 0
                curr_idx = 1
                next_idx = 2
            elif len(quizzes) == 1:
                curr_idx = 0
            else:
                if prev_date:
                    prev_idx = 0
                    curr_idx = 1
                else:
                    curr_idx = 0
                    next_idx = 1

        else:
            cursor.execute(
                '''
                select id, extract(epoch from date)
                from quizzes
                where user_id = %s
                order by date desc
                limit 2
                ''',
                (user_id,)
            )
            quizzes = cursor.fetchmany(2);
            if len(quizzes) == 2:
                prev_idx = 1
                curr_idx = 0
            else:
                curr_idx = 0

        (_, prev_date) = prev_idx is not None and quizzes[prev_idx] or (None, None)
        (quiz_id, date) = quizzes[curr_idx]
        (_, next_date) = next_idx is not None and quizzes[next_idx] or (None, None)

        cursor.execute(
            '''
            select lang_b.id, lang_a.lang_a, input from quiz_words
            join lang_b on lang_b.id = quiz_words.lang_b_id
            join lang_a on lang_a.id = lang_b.lang_a_id
            where quiz_words.quiz_id = %s;
            ''',
            (quiz_id,)
        )
        word_pairs = cursor.fetchmany(5);

    start_response('200 OK', [
        ('Content-Type', 'application/json'),
    ])
    return [json.dumps({
        'date': date,
        'quiz_id': quiz_id,
        'prev_date': prev_date,
        'next_date': next_date,
        'word_pairs': word_pairs,
    }).encode()]


def quiz_input(msg):
    with connection, connection.cursor() as cursor:
        cursor.execute(
            '''
            update quiz_words
            set input = %s
            where quiz_id = %s and lang_b_id = %s and
               quiz_id in (select id from quizzes where user_id = %s)
            ''',
            (msg['input'], msg['quiz_id'], msg['lang_b_id'], user_id)
        )

def edit_word(msg):
    with connection, connection.cursor() as cursor:
        cursor.execute(
            '''
            update lang_b
            set lang_b = %s
            where id = %s
            ''',
            (msg['lang_b'], msg['lang_b_id'])
        )


endpoints = {
    '/login/': {
        'handler': login,
        'check_auth': False,
    },
    '/refresh/': {
        'handler': refresh,
        'check_auth': False,
    },
    '/quiz/': {
        'handler': quiz,
    },
    '/words/': {
        'handler': words,
    },
}


messages = {
    'word-quiz-input': {
        'handler': quiz_input,
    },
    'edit-word': {
        'handler': edit_word,
    },
}

def process_ws(env, start_response):
    print(env)
    uwsgi.websocket_handshake(env['HTTP_SEC_WEBSOCKET_KEY'], env.get('HTTP_ORIGIN', ''))
    access_token = uwsgi.websocket_recv()
    user_id = decode_access_token(access_token)
    if not user_id:
        uwsgi.websocket_send('failed')
        return

    while True:
        msg = json.loads(uwsgi.websocket_recv())
        messages[msg['type']]['handler'](msg)


def process_http(env, start_response):
    try:
        endpoint = endpoints.get(env['PATH_INFO'], {
            'handler': unknown,
        })

        if not endpoint.get('check_auth', True):
            return endpoint['handler'](env, start_response)


        user_id = decode_access_token(access_token_from_env(env))
        if not user_id:
            return unauthorized(env, start_response)

        return endpoint['handler'](env, start_response, user_id)

    except Exception as e:
        print('Unhandled exception: ' + repr(e))
        raise
        start_response('500 Internal Server Error', [])
        return []


def application(env, start_response):
    if env.get('HTTP_SEC_WEBSOCKET_KEY'):
        return process_ws(env, start_response)
    else:
        return process_http(env, start_response)
