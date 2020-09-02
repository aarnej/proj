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
        refresh_token = SimpleCookie(env['HTTP_COOKIE']).get('refresh_token')
        if refresh_token:
            data = jwt.decode(refresh_token.value, JWT_SECRET, algorithm='HS256',
                              options={'require': ['exp', 'aud']},
                              audience='urn:refresh')
            start_response('200 OK', [
                ('Content-Type','application/json'),
            ])
            return [json.dumps({
                'access_token': access_token(data['user_id']),
            }).encode()]
    except jwt.PyJWTError:
        pass
    start_response('403 Forbidden')
    return []


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
            ('Set-Cookie', f'refresh_token={refresh_token}; Secure; HttpOnly; SameSite=strict'),
        ])
        return [json.dumps({
            'access_token': access_token(user_id),
        }).encode()]

    start_response('403 Forbidden')
    return []


def unknown(env, start_response):
    start_response('404 Not Found')
    return []

handlers = {
    '/login': login,
    '/refresh': refresh,
}

def application(env, start_response):
    handler = handlers.get(env['PATH_INFO'], unknown)
    try:
        return handler(env, start_response)
    except Exception:
        start_response('500 Internal Server Error')
        return []
