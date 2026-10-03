# Running the server on a VPS

This runs the Etebase server from the published Docker image, behind [Caddy](https://caddyserver.com/), which takes care of HTTPS with certificates from Let's Encrypt.
It's written for Debian, but works the same on any Linux with Docker.

Everything the server keeps is in the `etebase-data` volume: the database (SQLite), the data of the items, the configuration and the secret key.
The notes are end-to-end encrypted, so the server (and its backups) can't read them, but they are lost if the volume is.

## What's needed

- A host name for the server, e.g. `notes.example.com`, with a DNS record pointing to the VPS
- Ports 80 and 443 reachable from the internet (Caddy needs them to get the certificate)
- The image to be pullable: packages on the GitHub container registry start out private, so either make the
  `etesync-server` package public (in its package settings on GitHub), or log in on the VPS with a token that can read packages:
  `docker login ghcr.io -u <github user>`

## Installing

1. Install Docker and the compose plugin:

   ```
   sudo apt update
   sudo apt install docker.io docker-compose-v2
   ```

   (On Debian versions without `docker-compose-v2`, install Docker from [Docker's repository](https://docs.docker.com/engine/install/debian/) instead.)

2. Copy this directory to the VPS, e.g. to `/opt/etebase`, and configure it:

   ```
   cd /opt/etebase
   cp .env.example .env
   nano .env    # set ETEBASE_DOMAIN, and optionally ACME_EMAIL
   ```

3. Start it:

   ```
   sudo docker compose up -d
   sudo docker compose logs -f    # Caddy logs when it got the certificate
   ```

   `https://<your host name>/api/v1/authentication/is_etebase/` should now answer with an empty page (and status 200).

4. Create the admin account, and log in to the admin site at `https://<your host name>/admin/`:

   ```
   sudo docker compose exec etebase python manage.py createsuperuser
   ```

5. Signing up is closed to anyone the admin didn't add, so add the users in the admin site (Users → Add user, only a user name is needed).
   Then create the account in the app ("create an account") with that user name, under "Advanced settings" with the server URL `https://<your host name>`.
   The password chosen there is the user's password, the server never sees it.

## Backups

`backup.sh` writes a backup to `backups/` and removes the ones older than 14 days. Run it every night, e.g. with cron (`sudo crontab -e`):

```
17 3 * * * cd /opt/etebase && ./backup.sh
```

Also copy the backups off the VPS, they don't help if the VPS is lost.

To restore a backup:

```
sudo docker compose stop etebase
sudo docker compose run --rm -v "$PWD/backups:/backups:ro" --entrypoint sh etebase -c \
  'cd /data && rm -rf media && tar -xzf /backups/etebase-<date>.tar.gz && mv backup.sqlite3 db.sqlite3'
sudo docker compose start etebase
```

## Updating

Set `ETEBASE_VERSION` in `.env` to the new version, then:

```
sudo docker compose pull
sudo docker compose up -d
```

The database is migrated when the server starts. Make a backup before updating.

## Security

- Only open the ports for SSH, HTTP and HTTPS, e.g. with `ufw`: `sudo ufw allow OpenSSH && sudo ufw allow http && sudo ufw allow https && sudo ufw enable`.
  Docker's published ports are not affected by `ufw`, but here only Caddy publishes ports.
- Keep the system updated, e.g. with `sudo apt install unattended-upgrades`.
- Use SSH keys rather than passwords to log in to the VPS.

## Changing the configuration

The configuration is in `/data/etebase-server.ini` in the volume, created the first time the server is started.
For example, to add another host name or change the language, edit it and restart the server:

```
sudo docker compose exec etebase vi /data/etebase-server.ini
sudo docker compose restart etebase
```
