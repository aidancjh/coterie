# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Read PROJECT_STATE.md first

**Start every session by reading [`PROJECT_STATE.md`](PROJECT_STATE.md).** This file
(CLAUDE.md) describes how the code *works* and changes rarely. `PROJECT_STATE.md`
tracks where the project *is* — decisions made, tasks open, work completed — and
changes constantly.

Aidan works across two Windows machines with separate Claude sessions, so nothing
carries over between them except what is committed to git. `PROJECT_STATE.md` is
how context survives that.

**You must update `PROJECT_STATE.md` in the same turn as any change** — code added,
removed, or changed; a decision made or reversed; a task completed, deferred, or
dropped. Commit it together with the code. Never leave a change unrecorded.

`git pull` at the start of a session; `git push` at the end.

## Commands

```bash
npm run dev          # Start both API (port 4000) and Vite dev server (port 5173) concurrently
npm run dev:api      # API only — node --watch with .env
npm run dev:web      # Vite only
npm run build        # TypeScript check + Vite production build
npm run start        # Production server (Railway uses this)
npx tsc --noEmit     # Type-check without building
```

Local dev requires a `DATABASE_URL` in `.env`. The Railway-hosted Postgres is production-only; there is no local DB instance. You can still run `npm run dev:web` to test the frontend UI without the API.

## Architecture

**Full-stack monorepo**: React 18 + TypeScript + Vite 6 (frontend) served by Express 4 + PostgreSQL (backend). In production, Express serves the Vite build as static files and handles `/api/*` routes.

### Backend (`server/`)

| File | Purpose |
|------|---------|
| `index.js` | Express app — all API routes, auth middleware, email via Resend |
| `db.js` | `pg.Pool` connection, `initSchema()` (idempotent, runs on startup), `uid(prefix)` for IDs |
| `repo.js` | All SQL queries — single data-access layer |
| `auth.js` | `hashPassword`, `verifyPassword`, `signToken`, `requireAuth` middleware (JWT in `Authorization: Bearer`) |
| `seed.js` | `seedIfEmpty()` (once, empty DB), `syncDemoPasswords()` (every startup), `seedPastData()` (idempotent; runs on every startup **and** via the admin endpoint) |
| `admin-server.js` | Standalone admin API — separate Railway deploy, separate JWT (`ADMIN_JWT_SECRET`), own Google OAuth callback (lookup-only, never creates users), own rate limiter and DB pool cap. Mounts `adminRoutes.js`. |

Schema tables: `users`, `games`, `game_members`, `game_interest`, `game_comments`, `messages`, `game_reviews`, `player_ratings`, `notifications`, `feedback`, `highlights`, `highlight_likes`, `highlight_comments`, `password_reset_tokens`, `idempotency_keys`, `waitlist`.

**Two separate rating systems:**
- `game_reviews` — reviewer rates the HOST after a game they played in (not hosted). `UNIQUE(game_id, reviewer_id)`. Exposed as host star rating on profiles.
- `player_ratings` — player rates individual teammates. `UNIQUE(game_id, rater_id, rated_id)`. Anonymous, averaged as `playerRating` on profiles.

`pendingReviews(userId)` returns games the user played (not hosted), ended >2 h ago, <7 days ago, not yet reviewed. The `ReviewPrompt` component polls this 3 s after mount and shows a modal.

### Admin app (`server/admin-server.js` + `src/admin/`)

The admin dashboard is a **separate deployment** from the consumer app — different Railway
service, different subdomain, different JWT secret/audience (`ADMIN_JWT_SECRET`, not
`JWT_SECRET`). It shares the same Postgres database via `server/db.js`, but with its own
capped connection pool (`DB_POOL_MAX`) so admin traffic can never starve the consumer app.

- `server/admin-server.js` — Express entry, mounts `server/adminRoutes.js` behind
  `server/adminAuth.js`'s `requireAdminAuth`. Serves `dist-admin/` in production.
- `src/admin/` — separate React app (`src/admin-main.tsx` entry, built via
  `vite.admin.config.ts` into `dist-admin/`). Sign-in is a single shared password
  (`POST /api/auth/login`, bcrypt-hashed via `ADMIN_PASSWORD_HASH`, rate-limited via
  `adminLoginLimiter`) that logs into the existing admin user identified by
  `ADMIN_LOGIN_EMAIL` — that account must already exist with `role = 'admin'`.
- Local dev: `npm run dev:admin` (API, port 4100) + `npm run dev:admin:web` (Vite, port
  5174) — copy `.env.admin.example` to `.env.admin` first.
- `npm run build` produces both `dist/` (consumer) and `dist-admin/` (admin) from one command.

### Frontend (`src/`)

| Layer | Details |
|-------|---------|
| `lib/api.ts` | `api.get/post/patch/del` wrappers — reads JWT from `localStorage`, base URL from `VITE_API_URL` env var |
| `services/gamesService.ts` | All game mutations + reads; calls `notify()` after mutations so subscribers re-fetch |
| `auth/AuthContext.tsx` | React context for current user; `useAuth()` hook |
| `hooks/useProfile.ts` | Returns profile of logged-in user from context |
| `lib/format.ts` | `formatDate`, `formatTime`, `formatTimeRange`, `isPast`, `relativeDay` |

Pages: `BrowseGames` (includes the Upcoming/Hosting views), `GameHistory`
(past games, at `/history`, linked from Settings), `GameDetail`,
`CreateGame`, `EditGame`, `Interested` (starred games), `Chats`, `ChatRoom`,
`Notifications`, `UserProfile`, `Profile`, `Settings`, `Auth`, `Onboarding`,
`Privacy`, `Waitlist*`. (Marketplace and highlight *posting* were removed
2026-07-23 when the app adopted the preview's frontend; highlight *viewing*
remains.)

**Preview fork:** a tester-facing near-copy of this app (no admin, separate
DB) lives in a separate repo, `aidancjh/coterie-prototype`, deployed to its
own Railway project (`coterie-preview`) at https://preview.coterie.com.de.
Since 2026-07-23 the main app uses the SAME frontend (Coterie name, red/light
theme, desktop nav) — the fork's remaining deltas are infrastructure (own
Railway project + Postgres, no admin, seed date-shifting). It does NOT
auto-deploy on push — deploy from that folder with
`railway up --service web --ci`. When changing shared behavior here (forms,
validation, endpoints, UI), mirror the change there; see PROJECT_STATE.md for
what has been kept in sync so far.

`GameDetail.tsx` fetches `/api/games/:id/ratables` when the game is in the past and the user was a player — renders inline star pickers to rate teammates using `api.post` directly (not via gamesService).

## Demo credentials

| Email | Password | Name | Role |
|-------|----------|------|------|
| 1@demo.test | 111111 | Jia Min T. | Intermediate |
| 2@demo.test | 111111 | Wei Jie L. | Advanced |
| 3@demo.test | 111111 | Nur Aisyah B. | Beginner |
| 4@demo.test | 111111 | Arjun N. | Advanced |
| 5@demo.test | 111111 | Hui Wen O. | All Levels |

`syncDemoPasswords()` resets all `@demo.test` passwords to `111111` on every server startup.

To seed past games + fake reviews/ratings into an already-populated DB: log in as an admin and call `POST /api/admin/seed-past-data`.

## Deployment

Railway auto-deploys on every push to `main` on GitHub. No manual steps needed — just `git push`. Deploy takes ~2 min. Production URL: `https://coterie.com.de`.

On startup the server calls, in order: `initSchema()` → `seedIfEmpty()` → `syncDemoPasswords()` → `seedPastData()` → `promoteAdminsFromEnv()` (see `start()` in `server/index.js`).

## Key conventions

- **IDs**: `uid(prefix)` generates `prefix_<random>`. Demo/seed records use static IDs (e.g. `game_past_1`, `user_maria`) for idempotency.
- **Auth**: JWT stored in `localStorage` as `vb.token` (see `TOKEN_KEY` in `src/lib/api.ts`). `requireAuth` middleware sets `req.userId`. `requireAdmin` checks `users.role = 'admin'`.
- **Roles**: `user` (default) | `staff` | `admin`. Only admins can access `/api/admin/*`.
- **Game time logic**: `date` is ISO date string (`2026-06-20`), `time`/`endTime` are 24h strings (`"18:30"`). `isPast(date)` checks if date < today.
- **Tailwind**: Using Tailwind CSS 4.0 (Vite plugin, not PostCSS). Brand color is `text-brand` / `bg-brand` — **red `#d92632`**, defined as CSS variable `--color-brand` in `src/index.css` (with `--color-brand-dark: #b31e29`). The app is **light-themed**: components still use dark-slate utility classes, but `src/index.css` inverts the slate scale via `@theme` and remaps `.text-white` to dark ink (white stays white on colored surfaces). The **admin app keeps the old dark/blue theme** via its own stylesheet `src/admin/admin.css` (imported by `src/admin-main.tsx`), so consumer theme changes don't touch admin.
- **Branding**: the product is **Coterie** everywhere (UI, PWA manifest, emails, ICS, OG tags) as of 2026-07-23 — the Vybe name is retired. Logo is `BrandMark` in `src/components/icons.tsx` (red tile + white C); PNG icons regenerate via `node scripts/generate-icons.mjs`.

## Checking layout after a UI change

`scripts/layout-audit.js` is a console snippet (no dependencies) that measures a
page for the faults that actually show up as visible defects: a panel showing a
band of its own background because its contents didn't stretch with it, text
clipped without an ellipsis, anything poking outside the viewport, sideways page
scroll, ink the same colour as the surface behind it. Paste it into DevTools on
any page, then:

```js
__audit()                        // this page
await __go("/chats"); __audit()  // SPA-navigate, then re-check
```

Run it at ~375, 768 and 1440 wide after any layout change: the bug it was written
for only appeared in the 2-column desktop grid and was invisible on mobile.
Known-intentional clipping (the partial-fill star overlay, `.sr-only` text) is
excluded, so a clean run means clean. Colours are resolved by painting them to a
canvas — Tailwind 4 emits `oklch()`, which can't be compared component-wise
against `rgb()`.

## ⚠️ Mobile and desktop are one change, never two

**Every UI change must be made and checked on BOTH the phone and the laptop
layout.** They must match. This is not "verify if convenient" — an unchecked
breakpoint is an unfinished change.

The app is one responsive tree with real per-breakpoint divergence, so it is easy
to fix one and silently break, or simply not apply, the other:

- The bottom tab bar and its raised "+" (which opens the post sheet) are
  `lg:hidden` — **phone only**.
- The horizontal nav in the header is `hidden … lg:flex` — **desktop only**.
- `<main>`'s inner wrapper switches width per route at `lg:` (`lg:max-w-5xl` on
  Browse, `lg:max-w-2xl` elsewhere), and the shell drops its card framing at
  `lg:` (`lg:max-w-none lg:shadow-none`).

Because of that split, a defect can be reachable on **only one** of them. The
2026-08-03 white-on-white "Post a game" bug lived in the post sheet, which a
desktop browser cannot even open.

**Required for every layout/UI change:**

1. Apply the change to both layouts, and confirm they agree.
2. Re-check at ~375, 768 and 1440 wide (see the layout-audit section above).
3. **Show Aidan the phone result** — a screenshot at 375 wide — or, if a
   screenshot can't be produced (e.g. the Browser pane isn't displayed, so the
   page isn't compositing frames), **say so and confirm the intended result with
   him in words instead**. Never quietly skip this step.

## Brand voice — Convenient · Reliable · Inclusive

Aidan's tone of voice is **strictly these three adjectives** (set 2026-07-30, replacing
the earlier Open / Reassuring / Plain). They are not a mood board — they are a test.
**Every user-facing string** (UI, empty states, buttons, emails, notifications,
push, store listings, marketing pages) must do at least one of them and contradict
none. If a line does none of the three, cut it.

| Trait | What it means in copy | Do | Don't |
|---|---|---|---|
| **Convenient** | The reader can act immediately. Verb first, one idea, no hunting. Say how small the effort is when it's genuinely small. | "Join game", "Post a game — takes a minute", "Tap Join and you're on the roster" | "Get started", "Manage your participation", multi-clause sentences |
| **Reliable** | Say exactly what happens next, when, and by what rule. Numbers over adjectives. Never blame the user, never expose our plumbing. | "You'll be moved in automatically the moment a spot opens", "We'll remind you the day before", "Only leaving within 24 h of start counts against your participation" | "Waking up the server", "Something went wrong", "Don't worry!", vague "soon" |
| **Inclusive** | Assume no insider knowledge and no minimum standard. Beginners are the default reader, not an edge case. Explain volleyball terms in place. | "Every level welcome", "Not sure? Pick the closest — you can change it any time", "Setter, libero — or just Any" | "for real players", "advanced only", jargon with no gloss, anything implying a circle you're outside of |

Practical rules that fall out of this: no exclamation marks except at a genuine
celebration (a confirmed join); never state a rule in the UI that the code doesn't
enforce (a wrong FAQ answer is a reliability failure, not a typo); prefer stating
the mechanism ("auto-promoted from the waitlist") over reassurance ("don't worry").

The three **community values** (friendly, supportive, vocal, adaptable) describe the
players, not the product's voice — don't confuse the two. Full brand record, with
mission/positioning/audience, lives in `Coterie-Business-Overview.docx` (one level
above this repo).
