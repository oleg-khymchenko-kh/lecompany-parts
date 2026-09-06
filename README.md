# parts.lecompany.co.uk

Monorepo for **LE Company Parts & Equipment** — PCB/control board repair, spare parts,
and refurbished commercial machines.

```
apps/web    Next.js 16 (App Router, Tailwind v4) — the public site
apps/api    Fastify 5 + Prisma 7 + MySQL — the API
deploy/     production configuration and the deploy script
```

npm workspaces, Node 24, TypeScript throughout.

## Local development

```bash
npm install
cp apps/api/.env.example apps/api/.env   # then fill it in
npm run prisma:migrate --workspace @parts/api
npm run dev
```

- web on <http://localhost:3010>
- api on <http://127.0.0.1:3011>

The browser only ever calls `/api/...` on the web origin. In development Next rewrites
that to the API port; in production nginx does the same. The session cookie is therefore
always same-origin and no CORS preflight is involved.

## Deployment model

The production box holds **no sources and no repository access**. Everything is built on
the development machine and only the build output is shipped:

- `apps/web` builds to `.next/standalone` — a self-contained Node server with a pruned
  `node_modules`.
- `apps/api` compiles to `dist/` with `tsc`.

Two decisions follow from building on Windows and running on Linux, and both are
deliberate:

- **No native modules.** Passwords use `scrypt` from Node's own `crypto`, not
  `bcrypt`/`argon2`, because a module compiled for Windows will not load on Linux.
- **Prisma 7 driver adapters.** Prisma 7 talks to MySQL through `@prisma/adapter-mariadb`,
  a plain JS driver, so there is no platform-specific query engine binary to ship.

Database migrations are applied from the development machine over an SSH tunnel; the
Prisma CLI never runs on production.

## Data model notes

- Money is stored in **minor units (pence) as `Int`**, never a float.
- Session and magic-link tokens are stored as **SHA-256 hashes**; the raw value exists
  only in the cookie or the email.
- `OrderItem` snapshots the product name, SKU and unit price, so an order stays readable
  after the product changes or is deleted.
- Stripe webhooks are made idempotent by `processed_webhooks` — Stripe delivers at least
  once, and may deliver the same event twice.

## Known advisories

`npm audit` reports high-severity advisories in `mariadb` and `mysql2` (the MySQL driver
layer under Prisma's adapter) with **no fixed version published yet**. They concern
cleartext credential exposure to a man-in-the-middle and auth-plugin downgrade. This
deployment connects to MySQL over loopback on the same host, so there is no network path
for either. Re-check when upstream ships a fix.
