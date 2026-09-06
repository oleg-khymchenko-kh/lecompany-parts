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
directories keeping `<dir>.bak.<stamp>` for the last three releases, then
`pm2 reload`. Production holds no sources and no repo access, by the owner's
standing requirement.

`/home/parts.lecompany.co.uk/server/.env` is created by hand and is **preserved
across deploys** — the script copies it into the incoming release before the swap.

Opening several SSH sessions back to back trips sshd's default `MaxStartups` on
this box and the connection is reset; that is why the upload is one stream with
a retry, not four `scp` calls.

## Database

MySQL root needs a password on this box (no `auth_socket`, no `/root/.my.cnf`,
no `/etc/mysql/debian.cnf`). The `lecompany_user` account has rights only on its
own schema, so it cannot create ours.

Migrations are run from the development machine over an SSH tunnel; the Prisma
CLI is never installed on production.

## Outstanding

- MySQL root credentials → create `parts_prod` and its user
- Real Stripe keys (secret + webhook signing secret)
- SMTP credentials for magic-link and receipt email
- **MySQL is listening on `*:3306` with no firewall and is reachable from the
  public internet.** Verified from outside 2026-09-06. Not changed — it affects
  the live `app.lecompany.co.uk` database and needs the owner's go-ahead.
