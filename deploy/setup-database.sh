#!/usr/bin/env bash
#
# Run this ON the production server, as root:
#
#   bash /home/parts.lecompany.co.uk/setup-database.sh
#
# It creates the parts_prod schema and its own MySQL user, generates the
# password itself, and writes DATABASE_URL straight into the API's .env.
# Nothing secret has to be typed into a chat or pasted anywhere.
#
# It asks for the MySQL root password once, interactively — that value is never
# stored or echoed.

set -euo pipefail

DB_NAME="parts_prod"
DB_USER="parts_user"
ENV_FILE="/home/parts.lecompany.co.uk/server/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE does not exist" >&2
  exit 1
fi

# 32 URL-safe characters. Deliberately excludes characters that would need
# percent-encoding inside a connection URL.
DB_PASSWORD="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)"

echo "Creating ${DB_NAME} and ${DB_USER}. Enter the MySQL root password when asked."

mysql -u root -p <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

# Prisma Migrate needs a scratch database to diff against.
mysql -u root -p <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}_shadow\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON \`${DB_NAME}_shadow\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d-%H%M%S)"

# Replace the DATABASE_URL line in place, leaving everything else alone.
tmp="$(mktemp)"
grep -v -E '^(DATABASE_URL|SHADOW_DATABASE_URL)=' "$ENV_FILE" > "$tmp"
{
  echo "DATABASE_URL=\"mysql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:3306/${DB_NAME}\""
  echo "SHADOW_DATABASE_URL=\"mysql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:3306/${DB_NAME}_shadow\""
} >> "$tmp"
mv "$tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

pm2 restart parts-api --update-env >/dev/null
echo
echo "Done. ${DB_NAME} created and DATABASE_URL written to ${ENV_FILE}."
echo "The password was generated here and never left this machine."
