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
        'exp': datetime.now(timezone.utc) + timedelta(minutes=3),
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


def auth_ok(env):
    try:
        token = env['HTTP_AUTHORIZATION'].split()[-1]
    except (IndexError, KeyError):
        return False

    try:
        jwt.decode(token,
                   JWT_SECRET,
                   algorithm='HS256',
                   options={'require': ['exp', 'aud']},
                   audience='urn:access')
    except jwt.PyJWTError:
        return False

    return True


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
             f'HttpOnly; SameSite=Strict; Path=/api'),
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


def quiz(env, start_response):
    with connection, connection.cursor() as cursor:
        cursor.execute(
            'select id, lang_a from quiz_words join word_pairs on'
            ' quiz_words.word_pair_id = word_pairs.id where quiz_words.quiz_id = %s',
            ('dc8b334f-2b57-4bba-954f-a4cacd507b8b',)
        )
        word_pairs = cursor.fetchmany(5);

    start_response('200 OK', [
        ('Content-Type', 'application/json'),
    ])
    return [json.dumps(word_pairs).encode()]


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
    }
}

def application(env, start_response):
    try:
        endpoint = endpoints.get(env['PATH_INFO'], {
            'handler': unknown,
        })

        if endpoint.get('check_auth', True) and not auth_ok(env):
            return unauthorized(env, start_response)

        return endpoint['handler'](env, start_response)
    except Exception as e:
        print('Unhandled exception: ' + repr(e))
        start_response('500 Internal Server Error', [])
        return []
