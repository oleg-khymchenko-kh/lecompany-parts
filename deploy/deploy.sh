#!/usr/bin/env bash
#
# Deploy parts.lecompany.co.uk from this machine.
#
#   ./deploy/deploy.sh          # both web and api
#   ./deploy/deploy.sh web
#   ./deploy/deploy.sh api
#
# Production holds no sources and no repository access — everything is built
# here and only the build output is shipped. The web app goes as a Next.js
# standalone bundle, the API as a single esbuild file, so the server never runs
# npm install and never needs a toolchain.
#
# The previous release is kept beside the new one as <dir>.bak.<stamp>, which is
# the convention already used by app.lecompany.co.uk on this box.

set -euo pipefail

SSH_HOST="${SSH_HOST:-lecompany-server}"
REMOTE_ROOT="/home/parts.lecompany.co.uk"
KEEP_BACKUPS=3

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="${REPO_ROOT}/.deploy-stage"
TARGET="${1:-all}"

STAMP="$(date +%Y%m%d-%H%M%S)-$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo nogit)"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

if [[ "$TARGET" != "all" && "$TARGET" != "web" && "$TARGET" != "api" ]]; then
  echo "usage: $0 [all|web|api]" >&2
  exit 2
fi

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null)" ]]; then
  echo "warning: working tree is dirty — deploying uncommitted changes" >&2
fi

rm -rf "$STAGE"
mkdir -p "$STAGE"
PARTS=()

# ---------------------------------------------------------------- build: web
if [[ "$TARGET" == "all" || "$TARGET" == "web" ]]; then
  say "Building web"
  npm run build --workspace @parts/web

  # The standalone tracer emits apps/web/... plus a hoisted node_modules.
  # Flatten it so server.js sits at the root of public_html, which is what the
  # nginx /_next/static alias and the pm2 cwd both assume.
  WEB_STAGE="${STAGE}/public_html"
  mkdir -p "$WEB_STAGE"
  cp -R "${REPO_ROOT}/apps/web/.next/standalone/apps/web/." "$WEB_STAGE/"
  cp -R "${REPO_ROOT}/apps/web/.next/standalone/node_modules" "$WEB_STAGE/node_modules"
  # standalone deliberately omits these two; Next expects them next to server.js.
  cp -R "${REPO_ROOT}/apps/web/.next/static" "${WEB_STAGE}/.next/static"
  [[ -d "${REPO_ROOT}/apps/web/public" ]] && cp -R "${REPO_ROOT}/apps/web/public" "${WEB_STAGE}/public"

  PARTS+=(public_html)
fi

# ---------------------------------------------------------------- build: api
if [[ "$TARGET" == "all" || "$TARGET" == "api" ]]; then
  say "Building api"
  npm run build --workspace @parts/api

  API_STAGE="${STAGE}/server"
  mkdir -p "${API_STAGE}/dist"
  cp "${REPO_ROOT}/apps/api/dist/server.mjs" "${API_STAGE}/dist/"
  cp "${REPO_ROOT}/apps/api/dist/server.mjs.map" "${API_STAGE}/dist/"
  cp "${REPO_ROOT}/deploy/pm2/ecosystem.config.js" "${API_STAGE}/"
  # Migrations travel so they can be applied from here over an SSH tunnel and
  # so the server has a record of the schema it is running.
  [[ -d "${REPO_ROOT}/apps/api/prisma/migrations" ]] &&
    cp -R "${REPO_ROOT}/apps/api/prisma/migrations" "${API_STAGE}/migrations"

  PARTS+=(server)
fi

# ------------------------------------------------------------------- upload
# One archive over one connection. sshd's default MaxStartups drops the later
# ones when a deploy opens four sessions back to back, so keep the count low
# and retry rather than fail a half-finished release.
say "Uploading to ${SSH_HOST}"

upload() {
  tar -C "$STAGE" -czf - "${PARTS[@]}" |
    ssh -o ServerAliveInterval=15 "$SSH_HOST" \
      "mkdir -p ${REMOTE_ROOT}/backups/incoming && cat > ${REMOTE_ROOT}/backups/incoming/release.tar.gz"
}

attempt=1
until upload; do
  if (( attempt >= 3 )); then
    echo "upload failed after ${attempt} attempts" >&2
    exit 1
  fi
  echo "  upload attempt ${attempt} failed, retrying in 5s" >&2
  sleep 5
  attempt=$(( attempt + 1 ))
done

# ------------------------------------------------------------------- install
say "Installing release ${STAMP}"

# shellcheck disable=SC2087  # the heredoc is expanded here on purpose
ssh -o ServerAliveInterval=15 "$SSH_HOST" bash -s <<REMOTE
set -euo pipefail
ROOT="${REMOTE_ROOT}"
STAMP="${STAMP}"
TARGET="${TARGET}"
KEEP=${KEEP_BACKUPS}
ARCHIVE="\${ROOT}/backups/incoming/release.tar.gz"

rm -rf "\${ROOT}/.incoming"
mkdir -p "\${ROOT}/.incoming"
tar -xzf "\$ARCHIVE" -C "\${ROOT}/.incoming"

swap() {
  local name="\$1"
  [[ -d "\${ROOT}/.incoming/\${name}" ]] || return 0

  # .env holds the secrets and is created once by hand; it must survive a deploy.
  if [[ "\$name" == "server" && -f "\${ROOT}/server/.env" ]]; then
    cp "\${ROOT}/server/.env" "\${ROOT}/.incoming/server/.env"
  fi

  if [[ -d "\${ROOT}/\${name}" ]]; then
    mv "\${ROOT}/\${name}" "\${ROOT}/\${name}.bak.\${STAMP}"
  fi
  mv "\${ROOT}/.incoming/\${name}" "\${ROOT}/\${name}"

  # Keep the last few releases, drop the rest.
  ls -1dt "\${ROOT}/\${name}.bak."* 2>/dev/null | tail -n +\$((KEEP + 1)) | xargs -r rm -rf
}

swap public_html
swap server
rm -rf "\${ROOT}/.incoming" "\$ARCHIVE"

# Only ever touch this site's processes — the box also runs 'lecompany'.
cd "\${ROOT}/server"
if pm2 describe parts-api >/dev/null 2>&1; then
  pm2 reload parts-api --update-env
  pm2 reload parts-web --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save >/dev/null

pm2 list --no-color
REMOTE

say "Verifying"
sleep 3
curl -sS -o /dev/null -w "  https://parts.lecompany.co.uk/          %{http_code}\n" https://parts.lecompany.co.uk/ || true
curl -sS -o /dev/null -w "  https://parts.lecompany.co.uk/api/health %{http_code}\n" https://parts.lecompany.co.uk/api/health || true

rm -rf "$STAGE"
say "Done — release ${STAMP}"
