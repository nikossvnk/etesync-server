#! /bin/sh

set -e

CONFIG="${ETEBASE_EASY_CONFIG_PATH:-/data/etebase-server.ini}"

if [ ! -f "$CONFIG" ]; then
    # The server only answers requests for these hosts, so it has to be what the server is reached at
    HOSTS="${ETEBASE_ALLOWED_HOSTS:-localhost}"
    echo "Creating $CONFIG, allowing the hosts: $HOSTS"
    if [ -z "$ETEBASE_ALLOWED_HOSTS" ]; then
        echo "WARNING: ETEBASE_ALLOWED_HOSTS is not set. Set it to the host name(s) of the server, separated by commas,"
        echo "         or change [allowed_hosts] in $CONFIG."
    fi

    {
        echo "[global]"
        echo "secret_file = /data/secret.txt"
        echo "debug = false"
        echo "media_root = /data/media"
        echo ""
        echo "[allowed_hosts]"
        i=1
        for host in $(echo "$HOSTS" | tr ',' ' '); do
            echo "allowed_host$i = $host"
            i=$((i + 1))
        done
        echo ""
        echo "[database]"
        echo "engine = django.db.backends.sqlite3"
        echo "name = /data/db.sqlite3"
    } > "$CONFIG"
fi

cd /app
python manage.py migrate --noinput

exec uvicorn etebase_server.asgi:application --host 0.0.0.0 --port 3735 "$@"
