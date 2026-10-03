#! /bin/sh
# Backs up the data of the Etebase server to backups/etebase-<date>.tar.gz in this directory,
# and removes the backups that are older than the number of days in KEEP_DAYS (14 by default).
# Run it from cron or a systemd timer, e.g. every night:
#   17 3 * * * cd /opt/etebase && ./backup.sh
#
# To restore a backup, see README.md.

set -eu

cd "$(dirname "$0")"
mkdir -p backups
target="backups/etebase-$(date +%Y-%m-%d-%H%M%S).tar.gz"

# A consistent copy of the database, also while the server is running
docker compose exec -T etebase python -c "
import sqlite3
source = sqlite3.connect('/data/db.sqlite3')
backup = sqlite3.connect('/data/backup.sqlite3')
source.backup(backup)
backup.close()
"

# The data of the items, the configuration and the secret key, together with the copy of the database
docker compose exec -T etebase sh -c 'cd /data && tar -czf - backup.sqlite3 etebase-server.ini secret.txt $(ls -d media 2>/dev/null)' > "$target.tmp"
docker compose exec -T etebase rm -f /data/backup.sqlite3
mv "$target.tmp" "$target"
chmod 600 "$target"
echo "Backed up to $target"

find backups -name 'etebase-*.tar.gz' -mtime +"${KEEP_DAYS:-14}" -delete
