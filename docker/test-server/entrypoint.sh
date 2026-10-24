#! /bin/sh

echo "Running etesync test server ${ETESYNC_VERSION}"

cd /app
# Idle connections stay open longer than uvicorn's default of 5 seconds: clients that keep their
# connections open to reuse them (like Node's) otherwise send requests on connections that are
# being closed, which fail with "socket hang up"
uvicorn etebase_server.asgi:application --host 0.0.0.0 --port 3735 --timeout-keep-alive 75
