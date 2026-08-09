# Vybe — Operations Runbook

Practical guide for running Vybe in production (Railway + PostgreSQL).

---

## Environment variables (set in Railway → app service → Variables)

| Var | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | ✅ |
| `DATABASE_SSL` | `true` for cloud DB (public URL), `false` for internal | ✅ |
| `JWT_SECRET` | signs login tokens — long random string (server refuses to boot in production if unset) | ✅ |
| `APP_URL` | public base URL, e.g. `https://coterie.com.de` — used for CORS, OAuth redirect URIs, and email links | ✅ (prod) |
| `PORT` | set automatically by Railway | auto |
| `ADMIN_EMAILS` | comma-separated emails auto-granted admin on boot | optional |
| `SEED_DEMO` | `false` to launch with a clean DB (no demo logins like `1@demo.test/111111`, no fake sample games/reviews). Defaults to enabled | optional |
| `RESEND_API_KEY` | transactional email (join confirmations, password resets); emails skipped if unset | optional |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | enables "Sign in with Google" | optional |
| `SENTRY_DSN` | backend error reporting | optional |
| `VITE_SENTRY_DSN` | frontend error reporting (safe to expose) | optional |
| `VITE_CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | avatar + banner + highlight uploads (signed — see `POST /api/uploads/sign`) | optional |
| `CLOUDINARY_CLOUD_NAME` | scopes which Cloudinary URLs the API accepts to your own account | optional |

> **Before a public / app-store launch:** set `SEED_DEMO=false` so the production
> database has no publicly-known demo credentials or fake content. (Existing demo
> rows from earlier boots must be removed manually via SQL if already seeded.)

---

## Deploys and uptime (why UptimeRobot used to alert)

Until 2026-08-09 `app.listen()` was the **last** thing `start()` did, after schema
init and all demo seeding. Measured on the 8 August deploy:

```
00:35:28  Starting Container
00:35:48  [seed] synced 29 demo accounts          +20s
00:37:08  [seed] seedPastData: 360 player ratings +80s
00:37:14  [api] listening                         +6s   = 106s with the port shut
```

With no process listening, Railway’s edge has no upstream and returns **502**, so
every deploy was a ~2 minute outage. There were 13 deploys between 3 and 9 August;
that is where the UptimeRobot alerts came from. It was never a crash — memory peaks
at ~240 MB of 8 GB and CPU sits near zero.

Two changes fix it:

1. **The port opens first.** `start()` calls `app.listen()` before `initSchema()`, so
   the container is reachable in milliseconds. A `ready` flag guards the gap:
   `/healthz` returns **503 `{status:starting}`** and every `/api` route returns 503
   until schema + seeding finish, then both go green.
2. **`railway.json` sets `healthcheckPath: /healthz`** (timeout 300s). Railway now
   keeps the PREVIOUS deployment serving traffic until the new one answers 200, then
   cuts over. Deploys become zero-downtime and UptimeRobot sees nothing at all.

A side effect worth knowing: **a deploy that never goes healthy now fails and leaves
the old build running**, instead of replacing it with something broken. If a deploy
hangs in deploying, check the logs for `[api] ready` — if it never appears, the
database is unreachable and the healthcheck is doing its job.

`server/admin-server.js` gained a real `/healthz` too. It had none, and its catch-all
route would have answered the healthcheck with `admin.html` — a 200 that means
nothing. That service does no migration work, so it is ready as soon as it listens.

**Still slow, but no longer user-visible:** 106 seconds of startup is mostly
`seedPastData` / `seedEngagement` rewriting the same idempotent demo rows one query
at a time on every single boot. Worth batching, or skipping when the data is already
current. It now only delays cutover rather than causing an outage.

### UptimeRobot monitor settings

The edge log shows two monitors: `GET /` every 60s and `HEAD /healthz`. Point both at
**`/healthz`** — it is the only endpoint that actually checks the database, it stays
public with the access gate on, and once the gate ships `GET /` answers **302** to
`/waitlist` (fine if the monitor follows redirects, a false alarm if it does not).

## Granting yourself admin

**Option A — env var (preferred):** add `ADMIN_EMAILS=you@email.com` to the app
service variables and redeploy. On startup the server promotes those accounts to
`admin`. (You must already have signed up with that email.)

**Option B — direct SQL:** Railway → Postgres service → **Data** tab → run:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@email.com';
```

Then sign out and back in. The 🛠 **Admin dashboard** button appears on your
Profile, and `/admin` becomes accessible. Roles: `user`, `staff`, `admin`
(admin is enforced on the server, not just hidden in the UI).

---

## Database migrations

Schema changes are **idempotent** and run automatically on every server start
(`server/db.js → initSchema`): tables use `CREATE TABLE IF NOT EXISTS`, and
column additions use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. To add a
migration, append another idempotent statement there — it is safe to re-run.

There is no destructive migration tooling by design; never write a migration
that drops/renames a column without a backup first (see below).

---

## Backups

Railway Postgres includes automated backups on paid plans — check
**Postgres service → Backups** tab and confirm a schedule is enabled.

**Manual backup any time** (from your PC, using the *public* connection string
found in Postgres → Variables → `DATABASE_PUBLIC_URL`):

```bash
pg_dump "postgresql://USER:PASS@HOST:PORT/DB" > vybe-backup-YYYYMMDD.sql
```

Run this before any risky change. Store the file somewhere safe (not the repo).

## Restore

1. Create/choose a target database (a fresh Railway Postgres, or a local one).
2. Restore the dump:

   ```bash
   psql "postgresql://USER:PASS@HOST:PORT/DB" < vybe-backup-YYYYMMDD.sql
   ```

3. Point the app's `DATABASE_URL` at the restored database and redeploy.
4. Verify: open `/healthz` (should return `{"status":"ok"}`) and check the app.

---

## Monitoring & alerting

- **Uptime + health:** the app exposes **`/healthz`** (checks DB connectivity).
  Point a free monitor (e.g. UptimeRobot, Better Stack) at
  `https://<your-domain>/healthz` every 1–5 min; alert if it's not `200`.
- **Server errors:** all API errors are logged with `[api]` prefixes (viewable
  in Railway → app service → Deploy Logs). Requests are logged with method,
  path, status, and duration.
- **Crash/error tracking (recommended next):** add **Sentry**.
  - Backend: `npm i @sentry/node`, init at the top of `server/index.js` with
    `Sentry.init({ dsn: process.env.SENTRY_DSN })`, set `SENTRY_DSN` in Railway.
  - Frontend: `npm i @sentry/react`, init in `src/main.tsx` with a public DSN.
  - This requires a free Sentry account + DSN (not wired yet — placeholders only).
- **Performance:** Railway shows CPU/memory/HTTP metrics per service under the
  **Metrics** tab.

---

## Email (password reset & verification) — not yet enabled

These need an email provider **and a verified sending domain** to deliver to
arbitrary addresses. When ready:

1. Buy a domain and create a free **Resend** account; verify the domain.
2. `npm i resend`, set `RESEND_API_KEY` in Railway.
3. Add endpoints: request-reset (emails a signed, expiring token link),
   reset-confirm (validates token, sets new password), and verify-email on
   signup. The JWT/token plumbing mirrors the existing auth in `server/auth.js`.

Until then, the in-app account flow works without email; account recovery is
manual (admin can look up a user; a password reset needs the email step above).

---

## Routine checks

- After each deploy: open `/healthz`, then load the app and post/join a test game.
- Watch Deploy Logs for repeated `[api] ... 500` lines.
- Periodically confirm backups exist and a restore actually works (test it once).
