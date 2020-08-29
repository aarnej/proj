import psycopg2

def get_string():
    connection = psycopg2.connect(database = "web", port = "5433")

    cursor = connection.cursor()

    # Print PostgreSQL version
    cursor.execute("SELECT * from test;")
    result = cursor.fetchone()[0]
    cursor.close()
    connection.close()
    return  result


def login(env, start_response):
    start_response('200 OK', [
        ('Content-Type','text/html'),
        ('Set-Cookie', 'joo=testinki'),
    ])
    return [get_string().encode()]


def unknown(env, start_response):
    start_response('404 Not Found', [
        ('Content-Type','text/html'),
    ])
    return []

handlers = {
    '/login': login,
}

def application(env, start_response):
    handler = handlers.get(env['PATH_INFO'], unknown)
    return handler(env, start_response)
