# The image to run an Etebase server with. Unlike the test-server image it's not in debug mode,
# only the admin can create users, and all of its data is in the /data volume.
#
# Build it from the root of the repository:
#   docker build -t etebase-server -f docker/server/Dockerfile .
FROM python:3.12-alpine

ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_NO_CACHE_DIR=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt /requirements.txt
RUN set -ex ;\
    apk add --no-cache --virtual .build-deps gcc libc-dev libffi-dev make ;\
    pip install --progress-bar off --root-user-action ignore -r /requirements.txt ;\
    apk del .build-deps ;\
    adduser -D -u 1000 etebase ;\
    mkdir -p /data ;\
    chown etebase:etebase /data

COPY --chown=etebase:etebase . /app
WORKDIR /app

# The static files (of the admin site) are part of the image, the server serves them itself
ENV DJANGO_STATIC_ROOT=/app/static
# The configuration is created here the first time the server is started
ENV ETEBASE_EASY_CONFIG_PATH=/data/etebase-server.ini

USER etebase
RUN python manage.py collectstatic --noinput

VOLUME /data
EXPOSE 3735

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD wget -q -O /dev/null http://127.0.0.1:3735/api/v1/authentication/is_etebase/ || exit 1

ENTRYPOINT ["/app/docker/server/entrypoint.sh"]
