# parts.lecompany.co.uk — working notes

## Production server

- `157.245.41.21`, hostname **server5**, Ubuntu 24.04.4
- Connect with `ssh lecompany-server` (key `~/.ssh/lecompany_server`, user root)
- Node 24.14.1, npm 11.11.0, pm2 6.0.14, nginx 1.24.0, MySQL 8.4.9

**This box also hosts `app.lecompany.co.uk`.** Act on processes by name only —
never `pm2 restart all`, never `pkill node`. The `lecompany` pm2 app is not ours.

### Site layout

Mirrors `/home/app.lecompany.co.uk/`:

```
/home/parts.lecompany.co.uk/
  backups/      deploy staging (backups/incoming/release.tar.gz)
  db-structure/
  logs/         nginx + pm2 logs
  nginx/parts.lecompany.co.uk.conf   symlinked into /etc/nginx/sites-enabled/
  public_html/  Next.js standalone build, run by pm2 as parts-web on :3030
  server/       API bundle + .env + ecosystem.config.js, parts-api on :3031
```

One deliberate difference from `app.lecompany.co.uk`: that site is a static
Angular bundle served by nginx `try_files`. This one is server-rendered for
crawlability, so nginx proxies `/` to the Next server instead.

`location /api/` has a **trailing slash** on `proxy_pass`, so the prefix is
stripped: `/api/auth/login` reaches Fastify as `/auth/login`.

### Ports

| port | what |
|---|---|
| 3024 | `lecompany` app — not ours |
| 3030 | parts-web (Next.js) |
| 3031 | parts-api (Fastify) |

### TLS

Certificate issued 2026-09-06 with the certbot **nginx** authenticator, the same
method used for `app.lecompany.co.uk`. Expires 2026-12-05, renews automatically.
Cloudflare proxies the host, so the origin must answer on 443 — port 80 alone
gives a 526.

## Deploying

```bash
./deploy/deploy.sh          # web + api
./deploy/deploy.sh web
./deploy/deploy.sh api
```

Builds locally, ships one tarball over a single SSH connection, swaps the
directories keeping the last three releases as `<dir>.bak.<stamp>`, then
`pm2 reload`. Production holds no sources and no repo access, by the owner's
standing requirement.

`/home/parts.lecompany.co.uk/server/.env` is created by hand and is **preserved
across deploys** — the script copies it into the incoming release before the swap.

Opening several SSH sessions back to back trips sshd's default `MaxStartups` on
this box and the connection is reset; that is why the upload is one stream with
a retry, not four `scp` calls.

## Database

`parts_prod` and `parts_prod_shadow`, user `parts_user@127.0.0.1`, created by
`deploy/setup-database.sh`, which generates the password on the server itself so
it never travels through a chat or a command line here.

MySQL 8.4 authenticates with `caching_sha2_password`, which on a non-TLS
connection needs `allowPublicKeyRetrieval`. It is set explicitly in
`apps/api/src/db.ts` rather than in the URL, and is only acceptable because the
database is loopback-bound and 3306 is firewalled.

Migrations run from the development machine over an SSH tunnel — the Prisma CLI
is never installed on production:

```bash
ssh -f -N -L 13306:127.0.0.1:3306 lecompany-server
cd apps/api
DATABASE_URL="<server url, port 13306>?allowPublicKeyRetrieval=true" npx prisma migrate deploy
```

## Email

SendGrid over the v3 HTTP API, called with plain `fetch` — no SMTP and no
nodemailer, so there is nothing extra to bundle.

The SendGrid account has domain authentication for `autoe.co.uk` and
`autoenterprise.co.uk` **only**. `lecompany.co.uk` is not authenticated, and its
one verified sender is `office@lecompany.co.uk` — so that is what `MAIL_FROM`
uses, by the owner's decision. Any address on `parts.lecompany.co.uk` would be
rejected until the domain is authenticated, which is still worth doing: it also
buys proper DKIM alignment, which matters for sign-in links landing in inboxes
rather than spam.

`MAIL_BCC` sends a blind copy of every message to `ai@lecompany.co.uk`.

## Stripe

Live keys. Webhook endpoint `we_1UCoWgIIOsCbxco0NrWYhmm9` →
`https://parts.lecompany.co.uk/api/webhooks/stripe`, subscribed to
`checkout.session.completed` and `checkout.session.expired`, pinned to API
version `2026-08-26.dahlia` so event payloads match the SDK's typings.

The signing secret is shown by Stripe once, at creation. It is in `.env` and
nowhere else — recreating the endpoint is the only way to get a new one.

`STRIPE_PUBLISHABLE_KEY` is kept in `.env` but unused: Checkout is redirect-based,
so the browser never needs it.

## Security state

- 3306 and 33060 are dropped for anything but loopback (iptables, persisted with
  netfilter-persistent). Confirmed closed from outside on 2026-09-06; before
  that the MySQL banner was being served to the public internet.
- MySQL still binds `*:3306` rather than 127.0.0.1. The firewall covers it. The
  bind-address change needs a mysqld restart, which briefly interrupts
  `app.lecompany.co.uk`, so it has not been done.
- **The MySQL root password is sitting in `/root/.bash_history` in plaintext**,
  which is how it was recovered. It should be rotated and the line removed.
- The SendGrid key in `.env` is a **full-access** key, including
  `api_keys.create`. A restricted Mail-Send-only key would be safer.

## Verified working end to end (2026-09-06)

Exercised against production, with the test rows deleted afterwards:
registration, session cookie, `/auth/me`, server-side cart, Stripe Checkout
session creation, webhook signature rejection (unsigned and badly signed both
give 400, not a 500), and a real magic-link email delivered through SendGrid.

Not exercised: an actual payment. That would be a real charge on live keys.
