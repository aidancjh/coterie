# PROJECT_STATE.md — living state of Vybe / Coterie

> **This file is the single source of truth for _where the project is right now_.**
> `CLAUDE.md` explains how the code works (stable). This file tracks what has been
> done, what is decided, and what is left (changes constantly).
>
> **Claude: read this at the start of every session. Update it in the SAME turn as
> any change** — code added/removed/changed, a decision made or reversed, a task
> finished, scope cut. Never commit a code change without updating this file.
> Update protocol and rationale at the bottom.

**Last updated:** 2026-07-31 · **Branch:** `main` · **Status:** deployed, in testing, not publicly launched

---

## 1. Context — what this is and who's building it

**Vybe** (public domain: **coterie.com.de**) is a pickup-volleyball app. Hosts post a
game with a slot count; players browse and claim spots. Chat per game, in-app +
email notifications, profiles, host reviews, anonymous teammate ratings, highlights.

- **Owner:** Aidan. Solo, non-engineer, building via Claude Code. Windows PC +
  Windows laptop, switches between them. **No Mac.**
- **Stage:** feature-complete, deployed, in testing. Not yet publicly launched.
- **Goal:** publish to **both** Apple App Store and Google Play. Target window was
  ~1–3 months from 2026-06-23.
- **How Aidan tests:** on the **live** PWA on a real phone, not locally. So changes
  must be committed and pushed to deploy before they can be tested.

---

## 2. Architecture in one screen

```
Browser / PWA  ──HTTP──►  Express (Node 20)  ──SQL──►  PostgreSQL
   src/                      server/                    (Railway-hosted)
```

- **Frontend:** React 18 + TypeScript + Vite 6 + Tailwind 4, installable PWA.
- **Backend:** Node.js + Express 4 REST API. `server/index.js` (routes) →
  `server/repo.js` (all SQL) → `server/db.js` (pg Pool).
- **Database:** PostgreSQL on Railway. **Not in this repo, not on any local machine.**
  Reached only via `DATABASE_URL`. Schema is code: `initSchema()` in `server/db.js`
  runs on every boot.
- **Admin app:** separate Railway service (`server/admin-server.js` + `src/admin/`),
  separate JWT secret, own capped DB pool. Same database.
- **Host:** Railway. Auto-deploys on push to `main` (~2 min).
- **External services:** Sentry (errors), PostHog (analytics), Resend (email),
  Cloudinary (images/video), GitHub (source + Actions CI).

Full detail lives in `CLAUDE.md`. Ops/env vars in `OPERATIONS.md`. Deploy in `DEPLOY.md`.

---

## 3. Key decisions made (and why)

| Decision | Rationale | Date |
|---|---|---|
| **Slogan decided: "VOLLEYBALL FOR ALL"** — replaces "Find your players. Fill your games." everywhere it appeared as a slogan (waitlist header, Auth sign-in screen, browser tab title, PWA install name). Verified against Rec:lub's own site/listings same day: it is itself pickup-style (discover → request to join → auto-promoted waitlist, round robins/leagues/drop-ins), just spread across five sports rather than built for one — doc updated to say so rather than only "multi-sport." | Aidan's direct call, from the original design-brief tagline list. Shorter and more of a rallying cry than the 4 shortlisted candidates from 2026-07-29, which were chosen for cold-read clarity — a deliberate trade, made explicitly, not picked from that shortlist. | 2026-07-30 |
| **Category is "pickup volleyball," stated plainly** — the business overview's At a Glance table read "Social sports / community" without literally saying pickup volleyball, even though the rest of the doc already did throughout. Now "Pickup volleyball (social sports / community)." | Aidan asked directly whether "pickup" is the right word; it was already the doc's substantive framing, just not in that one summary field. | 2026-07-30 |
| **Tone of voice is strictly three adjectives: Convenient · Reliable · Inclusive** — replaces the earlier Open / Reassuring / Plain. Every user-facing string (UI, emails, notifications, store listings, marketing) must do at least one and contradict none; rules + do/don't table now live in `CLAUDE.md` under "Brand voice". | Aidan's own words, from the updated designer brief ("Jabez (App design)"). The three are also his answer to what people should think of the app, so voice and product attributes deliberately share two words. | 2026-07-30 |
| **Both sides of the marketplace are primary** — the player who can't find a game *and* the host who can't fill one. Beginners move from tertiary to secondary. | Aidan: "both seem important & primary to me" — neither side survives without the other. | 2026-07-30 |
| **Main app IS Coterie now** — red/light preview frontend adopted wholesale; Vybe name retired everywhere (UI, PWA, emails, OG). Marketplace + highlight posting removed to match the preview exactly. Resolves the Vybe/Coterie naming split. | Aidan prefers the preview's UI; one look across both apps. | 2026-07-23 |
| **Keep the custom Express backend** — do NOT move to Supabase/Firebase | The client can never reach the DB, so a missed rule is one buggy route, not a world-readable table. Fails closed by default. | 2026-07-20 |
| **Do NOT add Postgres RLS** | RLS needs per-request DB roles; the app connects as one owner role for every request, and owners bypass RLS. High complexity in the hot path, defends a threat already closed structurally. | 2026-07-20 |
| **Do NOT move the database off Railway** | Not required for launch. | 2026-06-23 |
| **Ship to stores by wrapping the PWA with Capacitor** | One codebase, both stores. iOS shell = WKWebView, so the store app is ~95% identical to the installed PWA. | 2026-06-23 |
| **Buy developer accounts LAST** (Apple $99/yr, Google $25 once) | No reason to pay before the build is final. Neither is purchased yet. | 2026-06-23 |
| **Human code review over AI-only review** | Aidan is engaging software engineers / paying for a review. Claude's job is to prepare scope, not replace it. | 2026-07-20 |
| **Git — not OneDrive — is the cross-device sync mechanism** | OneDrive syncs on a delay and creates conflict copies (`.gitignore` already hides `*-aidan.*` artifacts). | 2026-07-20 |
| **Secrets live only in Railway Variables, never in the repo** | A committed `JWT_SECRET` persists in git history forever. | 2026-07-17 |

---

## 4. Open tasks — what's left

Ordered by priority. Update status inline as these move.

### Before letting strangers in

| # | Task | Why it matters | Est. | Status |
|---|---|---|---|---|
| 1 | **Staging environment** — `staging` branch + 2nd Railway service + throwaway DB | The only `DATABASE_URL` points at **production**. Testing writes to real user data; `LAUNCH_AUDIT.md` skipped its live smoke test for this reason. Biggest current risk. | ~2 h | ⬜ Not started |
| 2 | **Route authorization audit** (~55 routes in `server/index.js`) | IDOR risk: `requireAuth` proves *who you are*, not *that this is yours*. Checks exist but are inconsistently placed (some in `index.js`, some pushed into `repo.js`). Earmarked for the hired engineers. | ~2 h | ⬜ Not started |
| 3 | **Set `SEED_DEMO=false`** in Railway at launch + delete demo rows | `1@demo.test`…`5@demo.test` / `111111` are loginable in production today, and fake seed games/reviews are visible. Deliberate for now — keep live during testing. | 5 min | ⬜ Deferred to launch |
| 4 | **Verify Railway backups exist AND test a restore** | An untested backup is not a backup. Unverified. | ~1 h | ⬜ Not started |
| 5 | **Upgrade `vite` 5→8 and `vitest` 2→4** | `npm audit` (2026-07-20) found 5 vulns — **all dev-only**, none reach production. But two matter locally on Windows: a vite dev-server path traversal and a `launch-editor` NTLM hash disclosure, both exploitable by a malicious website while `npm run dev` is running. Both fixes are **major version bumps**, so this needs a careful pass with build + tests verified, not a blind `audit fix --force`. | ~1–2 h | ⬜ Not started |
| 5b | **Decide on the 2 open Dependabot PRs** | PR #7 = production deps (8 updates) — merging auto-deploys to production. PR #6 = dev deps (10 updates). Needs Aidan's call. | ~30 min | ⬜ Awaiting Aidan |
| 7 | **Write a review-scope brief for the hired engineers** | So the paid review targets auth, ownership, and data exposure rather than generic feedback. | ~1 h | ⬜ Not started |

### At launch

| # | Task | Why | Status |
|---|---|---|---|
| 8 | Paid / always-on Railway | Kills cold starts. UptimeRobot pings `/healthz` as a stopgap today. | ⬜ |
| 9 | Lock down demo accounts (see #3) | | ⬜ |

### When wrapping for stores (Capacitor)

| # | Task | Why | Status |
|---|---|---|---|
| 10 | Add native origins to CORS — `capacitor://localhost` (iOS), Android app origin | `server/index.js:72` allows only the web origin. **Every API call from the wrapped app fails until this ships.** ~5 min change. | ⬜ |
| 11 | Android: build on Windows → Google Play internal testing | Fully doable on Windows. | ⬜ |
| 12 | iOS: rent a cloud Mac (MacinCloud ~$20–30/mo) → TestFlight | **Xcode is macOS-only; Aidan has no Mac.** Needed for this step only. | ⬜ |
| 13 | Buy Apple ($99/yr) + Google Play ($25) developer accounts | Last step. | ⬜ |
| 14 | Native push (APNs/FCM) | Optional — email + in-app notifications already work. | ⬜ Optional |

### Known issues / doc drift

| # | Issue | Status |
|---|---|---|
| 15 | `README.md` drift — wrong demo password, stale Railway URL, wrong brand colour, claimed a local DB that doesn't exist. | ✅ Fixed 2026-07-20 |
| 16 | The rotated-and-dead `JWT_SECRET` still sits in git history (commit `321ed9c`). Value is dead; history purge judged not worth the disruption. Accepted risk. | ✅ Accepted |
| 17 | Stray local branch `main-aidan` — confirmed fully merged into `main`, no unique commits, deleted. | ✅ Fixed 2026-07-20 |
| 18 | **ESLint ignores `server/` and `tests/` entirely** — the whole backend has never been linted. `npm run lint` only covers `src/`. Worth widening the config. | ⬜ Not started |
| 19 | Stale remote branches on origin: `main-aidan`, `cleanup/phases-0-2-hygiene-reliability-a11y`, `worktree-admin-split-analytics`. Deleting remote branches needs Aidan's OK. | ⬜ Awaiting Aidan |
| 21 | **The consumer feedback / bug form is unreachable.** `submitFeedback()` in `src/services/gamesService.ts`, `POST /api/feedback`, the `feedback` table and the admin Feedback inbox all still work, but `Settings.tsx` lost the rows that opened the form in the July 2026 frontend change (its `panel` state still has `"feedback" \| "bug"` cases with nothing to trigger them). Testers currently have no in-app way to report anything. | ⬜ Not started |
| 22 | **Mirror the 2026-07-30 tone-of-voice copy pass to `coterie-prototype`** — Onboarding, Browse empty states, GameDetail modals, Settings FAQ, GameForm cost hint, meta description, and `server/email.js` colour/copy fixes. The fork shares this frontend, so testers are reading the old copy. | ⬜ Not started |
| 23 | **Mirror the 2026-07-30 price-display fix to `coterie-prototype`** — `CostBadge` on `GameCard`, unconditional cost row on `GameDetail` + join modals, `formatMoney`/`formatCost` moved to `lib/format.ts`. | ⬜ Not started |
| 25 | **`README.md` still has pre-rebrand drift** — brand colour listed as blue `#0b6ecd` (actual: red `#d92632`) and typeface listed as `Inter` (actual: Public Sans), a few lines below the 2026-07-30 name/tagline fix. Also references `Start Vybe.bat` by its literal filename — left alone since renaming it could break an existing desktop shortcut. | ⬜ Not started |
| 20 | **Mirror the waitlist `campaign` field to `coterie-prototype`** — `WaitlistDesktop.tsx`/`WaitlistMobile.tsx` now also capture `?utm_campaign=` and send it to `/api/waitlist`; the preview fork's copies of these pages + its `/api/waitlist` route need the same change (its own DB, no admin, so no funnel chart there to add). | ⬜ Not started |
| 26 | **Mirror the 2026-07-31 Browse filters change to `coterie-prototype`** — court type + net height now multi-select, net height reordered, "All Levels" and every "Any" chip removed from the filter modal, Game-time range now clamps to stay valid. Fork shares this frontend. | ⬜ Not started |
| 27 | **Mirror the 2026-07-31 GameForm required-fields change to `coterie-prototype`** — cost per person and end time are now compulsory (0 still valid for a free game), cost input restricted to digits + one decimal point. Fork shares this frontend. | ⬜ Not started |

---

## 5. Completed — do not redo

**Cost per person + end time made compulsory on the host form (2026-07-31):**
- Aidan: both were labelled "(optional)" in `GameForm.tsx` and had no
  validation — a host could post a game with neither set.
- ✅ **Cost per person** is now required, but 0 (free) is a fully valid
  answer — the point was to stop the field being *skippable*, not to forbid
  free games. This needed its own tracked `costText` string state rather than
  reusing `form.costPerPerson` directly: the old input displayed `""` whenever
  the numeric value was falsy (`0`), which made an untouched field
  indistinguishable from an explicit "$0" — a host could submit without ever
  seeing or touching the box. `costText` starts empty only for a genuinely new
  game (detected via `initial === blankGame` reference equality, since
  `CreateGame.tsx` passes that constant unmodified); editing an existing free
  game now correctly shows `"0"`, since that value was already a real,
  host-made decision.
- ✅ Input switched from `type="number"` to `type="text"` +
  `inputMode="decimal"` with a new `filterCostInput()` that strips everything
  but digits and a single `.` on every keystroke — closes the gap where a
  native number input still accepts `e`/`+`/`-` (e.g. `1e5`), which a `$`
  field never should.
- ✅ **End time** required the same way as the other required fields
  (`missingFieldsMessage`, red border via `fieldCls`, scroll-and-focus via
  `focusInvalid`) — no new validation pattern, just extended to a field that
  had been skipping it.
- Both labels dropped their "(optional)" suffix. `FIELD_LABEL` gained
  `costPerPerson`/`endTime` entries so the combined "please fill in…" sentence
  reads naturally when several fields are missing at once.
- Verified: `npx tsc --noEmit` and `npm run build` both clean. Not yet
  exercised live — same local-DB gap as the Browse filters change below (§
  "How Aidan tests"), needs a check on the deployed PWA.

**Browse filters — multi-select, reordered, validated (2026-07-31):**
- Aidan: net height and court type were single-select when they should allow
  multiple; net height's option order didn't follow actual height; "Standard"
  (skill) still offered "All Levels" and every group had a separate "Any" chip
  to clear it, which he wanted gone now that no-selection already means "no
  filter."
- ✅ `Filters.type`/`.netHeight` (single strings) → `.types`/`.netHeights`
  (arrays) in `src/pages/BrowseGames.tsx`, matching how `.skills`/`.positions`
  already worked. Court type and net height now render through the existing
  `MultiChipGroup` instead of the single-select `ChipGroup`, which is deleted
  (no remaining callers). URL param sync (`filtersToParams`/`paramsToState`)
  and the `visible` filter pipeline updated to `.includes()`/`.some()` over
  the arrays; the `netHeight === "Mixed" matches legacy "Recreational"` quirk
  preserved per-item in the new `.some()`.
- ✅ `netOptions` reordered ascending by actual height: Women's (2.24m) →
  Mixed (2.35m) → Men's (2.43m) (was Men's/Women's/Mixed).
- ✅ "All Levels" removed from the Standard filter's `skillOptions` — filter
  chip only, **not** touched in `GameForm.tsx`'s `skills` list, so hosts can
  still tag a game "All Levels"; there's just no chip to filter for it. Mirrors
  the precedent already set for the *personal* skill picker (§ "Retired
  options" in the 2026-07-27 entry above), now extended to this filter.
- ✅ The "Any" clear-all chip removed from `MultiChipGroup` across all four
  groups (court type, standard, net height, position needed) — deselecting a
  group already means "no filter," so the extra chip was redundant with just
  tapping active chips off, or "Reset" in the footer.
- ✅ **Date validation**, scoped by Aidan to the existing Game-time From/To
  range (Browse has no separate date field, only this time-of-day range):
  changing From past the current To (or To before the current From) now
  clamps the other bound to match, so the range can never invert into a
  filter that silently returns zero games.
- Verified: `npx tsc --noEmit` clean. Could not exercise the modal live —
  local dev has no `DATABASE_URL` (see § "How Aidan tests"), login 500s
  locally as expected; needs verification on the deployed PWA per the usual
  workflow.
- **Not yet done:** mirror to `coterie-prototype` — same situation as #20/22/23
  above, needs its own `railway up --service web --ci` since that fork shares
  this frontend.

**Real participation rate + profile UI cleanup (2026-07-27):**
- ✅ **Participation % is now real.** It was a placeholder (`80 + played +
  hosted*2`) that could only ever rise. `leaveGame()` DELETEs the membership
  row, so nothing recorded that a player had ever claimed a slot — new
  `game_dropouts` table (`server/db.js`) captures every departure with
  `hours_before` and a latching `late` flag. Rate =
  attended / (attended + late bails), null until there's history
  (`getParticipationRate` in `server/repo.js`).
- **Decision:** only leaving within **24 h** of start counts against you
  (`LATE_LEAVE_HOURS`). Aidan's call — penalising early leaves would just push
  people to no-show instead of freeing the slot. Every leave is still recorded
  regardless, so the threshold can change later without data loss. Hosts
  leaving their own game are never counted.
- ✅ Shown beside the stars on **both** own and other users' profiles, including
  when the player has no rating votes yet — new `ParticipationStat` in
  `Badges.tsx`, and `RatingEmpty` now takes `participationRate` (reliability is
  attendance-derived, so it exists independently of ratings). Renders "—" when
  there's no history so the block keeps its shape.
- ✅ **Cover/banner feature deleted** — `BANNER_COLORS`, the `BannerCropper`
  component, all banner state/handlers and the profile-card banner strip are
  gone (Profile.tsx 779 → 502 lines). The `banner_color` / `banner_image`
  columns and their API fields are left in place: harmless, and dropping them
  is a destructive migration for no user-visible gain.
- ✅ Profile view: bare pencil icon → labelled **"Edit profile"** pill.
- ✅ Edit profile: Cancel/heading no longer read as one run-on phrase (heading
  centred with a spacer); the camera overlay that covered the whole avatar is
  replaced by an **"Edit picture"** button underneath, so the photo is actually
  visible; "Tap to change photo" removed.
- ✅ Retired options: **All Levels** (personal skill), **Non-binary**,
  **Defensive Specialist** — removed from Profile *and* Onboarding pickers. The
  server allowlists (`validation.js`) and the label/abbreviation maps
  deliberately still carry them so existing profiles keep rendering; they just
  can't be newly selected. The skill "?" explainer now lists only selectable
  levels instead of every `SKILL_INFO` key.
- ✅ `.claude/launch.json`: the `api` entry pointed at a hardcoded
  `C:\Users\ebonwhale\...` path from the other machine; now relative so it
  resolves on both.
- Mirrored into `coterie-prototype` (see §"Preview fork sync" below).

**Profile header rebuilt + tab-highlight fix (2026-07-29):**
- ✅ New `src/components/ProfileHeader.tsx` is used by **both** `Profile.tsx` and
  `UserProfile.tsx`. Aidan's requirement was that the two be *exactly* the same;
  one shared component makes that structural rather than a thing to police.
  Verified live: both render 216×343, avatar 80×80 at the same offset, name at
  the same y — byte-identical measurements.
- ✅ Layout: brand band, avatar, name, and a subtitle that is now **standard +
  position** (was free-text). No location, no follow button (neither wanted).
  Stats collapse to **one line: Joined · Hosted · Participation · Reviews**,
  replacing the old 3-card grid. Participation was also dropped from the pages'
  calls to RatingHero/RatingEmpty to avoid showing twice — **reversed the same
  day, see below**.
- ✅ The only own-vs-other difference is the action slot — "Edit profile" for
  yourself, a 3-dot report menu for others. The slot is a fixed-height bar
  either way, so swapping one for the other cannot shift the layout.
- ✅ **Host reviews finally surfaced.** They were collected since launch and
  displayed nowhere (was a named to-do in §9). `getUserProfile` and
  `/api/auth/me` now return `hostRating`, feeding the Reviews stat.
  `getUserGameCounts()` was extracted so `/api/auth/me` can fill the stat row
  without building an entire public profile.
- ✅ **Report a user**: `"user"` added to `REPORT_TYPES`; new `ReportUserMenu`
  posts to the existing `POST /api/reports` with five preset reasons. No new
  backend was needed — the reports queue and admin review screen already existed.
- ✅ **Tab-highlight bug fixed.** `/user/*` was mapped to `/profile`, so opening
  another player lit the Profile tab as though you were viewing your own
  account. `tabRootFor` no longer maps it; new `useActiveTab` keeps the last
  real tab lit for routes belonging to no tab. Verified from Browse, Chats,
  Alerts and Profile — each keeps its own tab lit. A cold deep-link to
  `/user/:id` lights nothing, which is correct: there is no tab you came from.
- ✅ **"Any" now reads "Any position"** in GameForm chips + helper text and on
  GameDetail; the open-spots filter reads "Any number". The stored value stays
  `"Any"` — changing it would orphan every game already saved with it.

**Old slogan swept from every domain and doc (2026-07-30):**
- Aidan, in follow-up: "CHANGE EVERYTHING TO VOLLEYBALL FOR ALL... check every
  possible domain... including the docs and whatever." The earlier pass (above)
  only covered the live app; this pass covered everything else.
- ✅ Full case-insensitive repo grep for the phrase, then fixed every real hit:
  - **`README.md`, `STORE.md`, `STORE_LISTING.md`** — all three still opened
    with "Vybe — find your players, fill your games." `STORE_LISTING.md`
    especially matters: it's paste-ready App Store/Play Store submission copy
    with character-limit budgets noted per field. Recomputed exact lengths
    rather than guess — Play short description 68/80 chars, Apple subtitle
    now just "Volleyball for all" at 18/30 chars. `STORE.md`'s `npx cap init
    Vybe …` example command fixed too (would have named the native app shell
    wrong if run as written).
  - **`scripts/generate-icons.mjs`** — deleted rather than patched. It baked
    the old tagline into a generated OG image, but it was already fully
    superseded by `scripts/gen-logo.mjs` (real logo artwork vs. this script's
    placeholder red-tile mark) and depended on `sharp`, which `gen-logo.mjs`'s
    own header comment explains was dropped because `sharp`'s native binary
    breaks under this OneDrive-synced `node_modules`. Confirmed zero other
    references before deleting; `sharp` removed from `package.json`
    (`npm uninstall`) since nothing else used it.
  - **`coterie-prototype`** (preview.coterie.com.de) — same header-kicker,
    Auth-subtitle and `<title>` fix as the main app, committed and pushed to
    its own GitHub repo, then **deployed live** via `railway up --service web
    --ci` (confirmed linked to project `coterie-preview` / service `web`
    first). Its meta description also got the main app's tone-of-voice
    description swapped in — its old one ("Coterie helps you find players and
    fill your volleyball games…") was a paraphrase of the same banned pattern,
    not just stale wording. Task #24 (queued below) is now done, not deferred.
  - `Coterie-Business-Overview.docx` re-verified clean (zero matches in the
    unzipped XML) — already fixed in the prior pass.
  - Checked and left alone: `Content creation plan for Volleyball app.docx`
    (verified clean, zero matches). `PROJECT_STATE.md`'s own changelog entries
    documenting this phrase's removal are historical record, not live copy —
    correctly left as-is. `LAUNCH_AUDIT.md`, `SHARE_WITH_TESTERS.md`,
    `APP_STORE_PROMPTS.md`, `OPERATIONS.md`, `DEPLOY.md` don't contain the
    phrase at all (only matched an earlier broad "Vybe" search, not this one).
- **Not done, flagged rather than silently expanded:** `README.md` still has a
  wrong brand colour (`#0b6ecd` blue — actual is red `#d92632`) and wrong
  typeface (`Inter` — actual is Public Sans) a few lines below the fix above,
  and `Start Vybe.bat` keeps its filename since renaming it could break
  Aidan's own desktop shortcut without his OK. Separate pre-existing drift,
  not part of this ask — logged as #25.

**Slogan shipped: "VOLLEYBALL FOR ALL" (2026-07-30):**
- Aidan asked to confirm the app's category (pickup volleyball, not really
  "networking") and to ship the decided slogan to the waitlist page and the main
  app.
- ✅ Verified live via WebSearch before writing anything down: Rec:lub's own
  site + app-store listings show a genuinely pickup-style loop (discover →
  request to join → auto-promoted waitlist, plus round robins/leagues/drop-ins)
  — it *is* a pickup comp, just spread across five sports. Business overview's
  competitor section updated from "multi-sport app" to say this explicitly, with
  a new source citation.
- ✅ Replaced the old slogan (**"Find your players. Fill your games."**)
  everywhere it appeared as a brand slogan:
  - `WaitlistDesktop.tsx` + `WaitlistMobile.tsx` — the header kicker next to the
    logo, which read "Volleyball · Singapore," now reads "VOLLEYBALL FOR ALL"
    (brand red, uppercase). Chose this spot deliberately over the hero
    headline/value-prop copy: both waitlist layouts' hero text is explicitly
    documented as pixel-tuned against the silhouette art and conversion-tested,
    so it stays untouched. Verified no overflow/overlap at 1440, 375, and the
    file's own called-out worst case of 320px wide.
  - `Auth.tsx` — the "Find your players. Fill your games." subtitle under the
    logo on the sign-in screen, same red-uppercase treatment (source text stays
    sentence-case, `uppercase` class does the rendering — matches the
    convention already used for "out of 5" etc. in `Badges.tsx`).
  - `index.html` `<title>` and the PWA manifest `name` in `vite.config.ts` —
    plain-text contexts (browser tab, OS app-switcher/install prompt), so kept
    in normal case rather than shouting caps there.
  - Left untouched: the meta `description` (rewritten in the tone-of-voice pass
    two days ago; a description and a slogan are different content types,
    conflating them would hurt the search snippet) and the older "Vybe"-era
    docs (`README.md`, `STORE_LISTING.md`, `scripts/generate-icons.mjs`) —
    pre-existing debt, out of scope for this ask.
- ✅ `Coterie-Business-Overview.docx` updated in place (Word-validated, 25 pp.):
  cover tagline, the At-a-Glance Category field, the tone-of-voice section's
  tagline paragraph (now states the decision instead of "not chosen yet," with
  the winning candidate marked in the original 8-line list), and the
  Rec:lub-is-pickup-too note above.
- Not mirrored to `coterie-prototype` — same situation as the tone-of-voice and
  price-display passes: shares this frontend, needs its own `railway up`.

**Price always shown; audited against every host-entered field (2026-07-30):**
- Aidan: ensure price shows on the browse page and on the game detail page, and
  that every other host-entered detail is shown when a game is opened.
- Audit method: enumerated every field in `NewGameInput`/`GameForm.tsx` (the
  form the host actually fills in) and checked each against what
  `GameDetail.tsx` and `GameCard.tsx` render. Two real gaps found, both about
  price specifically — everything else the host enters was already displayed
  (gender/net height/positions are conditionally hidden, but only when they're
  the unremarkable default, e.g. "Open" or "Any position", which is correct,
  not a gap). `region` and `rotationType` are dead fields no longer exposed by
  the form (removed per an earlier decision, still allowlisted server-side for
  old rows) — not host-entered today, nothing to surface.
- ✅ Gap 1: **the browse card never showed price at all.** New `CostBadge` in
  `Badges.tsx` (same neutral styling as the type/skill pills, so it reads as
  one badge language rather than a new accent colour) added to `GameCard.tsx`,
  in the host/skill row — the one row measured to have genuine spare width
  (~60–90px across real cards) on both the title row and the fill-bar row,
  which are already near capacity with long titles or a full "Full · join
  waitlist (14/14)" spots label. `GameCard` is shared by Browse, Interested and
  hosted-games lists, so all three got it from one change.
- ✅ Gap 2: **on the detail page and both join-confirmation modals, the cost row
  only rendered when `costPerPerson > 0`** — a free game showed no price row at
  all, which reads as "unknown," not "free." Now unconditional everywhere,
  showing "Free" when the host left it blank.
- ✅ `formatMoney` moved from a private function in `GameDetail.tsx` to
  `src/lib/format.ts` (now shared by `GameCard`, `GameDetail`, `Badges`); new
  `formatCost()` alongside it returns `"Free"` for 0 rather than `"$0"`.
- Not mirrored to `coterie-prototype` yet — that fork shares this frontend and
  needs the same fix, but mirroring means its own `railway up`, which wasn't
  part of this ask.

**Game card seam fixed + whole-site layout audit (2026-07-30):**
- Aidan spotted that a card's red date rail didn't run the full height of the
  card. Measured on production: the card was 169.5px tall while its inner row was
  146px — **23px of white showing below the rail**, inside the card's rounded
  corner.
- Cause: `GameCard`'s link was `display: block` wrapping a `flex` row. In the
  2-column desktop grid every card in a row is stretched to the tallest one, but a
  block-level link leaves its inner row at natural height, so the shorter card's
  rail stopped early. Invisible on mobile, where the list is `space-y-3` and every
  card is its natural height — which is why it survived this long.
- ✅ Fix: the link *is* the flex row now (`flex` on the `<Link>`, wrapper div
  removed), so both columns stretch with the card.
- ✅ New `scripts/layout-audit.js` — a zero-dependency console snippet that
  measures a page for this class of fault (`stretched-not-filled`), plus clipped
  text with no ellipsis, elements outside the viewport, sideways page scroll and
  ink matching its background. Documented in `CLAUDE.md`. Two things it gets right
  that a naive version doesn't: colours are resolved by painting to a canvas
  (Tailwind 4 emits `oklch()`, which can't be diffed component-wise against
  `rgb()` — doing so produced false "invisible text" hits), and deliberately
  clipped things are excluded (`aria-hidden` subtrees such as the partial-fill
  star overlay, and `.sr-only` text).
- Audited **/, /interested, /chats, /notifications, /profile, /settings, /create,
  /privacy, /game/:id, /user/:id and the Upcoming/Hosting/Past tabs at 375, 768
  and 1440 wide**. The card was the only real fault anywhere; everything else came
  back clean.

**Image resampling rewritten — every generated logo asset (2026-07-30):**
- Aidan: zoomed in, the logo "looks slightly pixelated, doesn't look as rounded".
  He was right, and the cause was in `gen-logo.mjs`'s resizer, so it affected
  **every** generated asset, not just the exports.
- The old `downscale()` was a box filter that snapped each output pixel to whole
  source pixels. Two consequences: at a 3.1× reduction each output pixel averaged
  3 *or* 4 source pixels depending on where it landed, which puts a stair-step on
  a circle's edge; and when the target was **larger** than the source it collapsed
  to one source pixel — plain nearest-neighbour. The cover banner scales the
  wordmark's 188px-tall ink to 200px, so the curves there were being duplicated
  pixel-for-pixel. That is what he saw.
- ✅ Replaced with `resample()`: separable **Lanczos-3** with fractional weights,
  in premultiplied alpha (so transparent pixels can't bleed colour into the
  edge), kernel widened by the reduction factor when shrinking, and clamped on
  output because Lanczos overshoots slightly at a hard edge. `downscale` is now an
  alias, so all existing call sites — app icons, maskable, favicon, OG image,
  splash — got the fix too. Verified by magnifying the same region of the old and
  new files at the same scale: staircase → smooth anti-aliased curve.
- ✅ Logo tile exports went 512 → **1024** (the mark artwork is 1024², so the
  inner 656px is still a reduction). The 512 files are deleted, not kept
  alongside.
- Cost worth knowing: the inlined splash data URI grew 5 KB → 9 KB, because
  smooth gradients compress worse than flat nearest-neighbour blocks.
  `index.html` is 13.8 KB total — still far better than the 74 KB network fetch
  it replaced.

**Brand exports for outside-the-app use (2026-07-30):**
- Aidan needed a cover image and a logo image for the Tally volleyball survey.
  `scripts/gen-logo.mjs` step 8 now also writes **`brand-exports/`**, so these
  can't drift from the artwork and exist on both machines:
  - `coterie-cover-red-2400x400.png` — white wordmark centred on brand red, plus
    a `-kerned` variant (see below).
  - `coterie-logo-tile-white-512.png` / `coterie-logo-tile-red-512.png` — square
    logo tiles, mark inset 18% (vs 13% for the app icons) so a **circular** crop
    can't clip it.
- New helpers in that script: `knockout()` turns the artwork pure white with the
  ball's seams punched to transparent — the reversed-logo treatment, so the
  background shows through the seams instead of the seams being white-on-red;
  and `trim()` crops to the visible ink so centring isn't thrown off by the
  artwork's own margins.
- The cover is 6:1 with the wordmark held under 40% of the width on purpose: form
  covers are centre-cropped, and that keeps the wordmark whole even when the
  strip crops to mobile proportions.
- **Spacing fix, same day** (Aidan: "the spacing for coterie doesn't look that
  good"). Two measured causes, both addressed:
  1. *Optical centring.* "coterie" is all lowercase with no descenders, so the
     top 30% of its bounding box holds 10% of the ink (the t stem and the i dot).
     Centring the box therefore sat the word ~9% of its own height low. The
     banner now centres on the ink **mass centroid** vertically (a 17px lift at
     200px tall) and on the bounding box horizontally. Wordmark also grew from
     44% → 50% of the banner height.
  2. *Uneven letter clearances.* Measured on the artwork at 1056px wide, the
     clearances are `c→ball 27 · ball→t 28 · t→e 10 · e→r 19 · r→i 1 · i→e 20`.
     Two faults in opposite directions: the ball was kerned as a solid red disc,
     so knocking it out (seams break the silhouette) leaves it reading narrower
     than the 27–28px it was given and the word splits into three pieces; and
     **the r's arm passes within 1px of the i's dot** — everywhere else those two
     letters are 62px apart, which is why only the top of the pair looked wrong.
     `normalizeGaps()` drops or inserts empty columns so every interior clearance
     lands in [12, 20]: `20·20·12·19·12·20`. Shipped as a **separate `-kerned`
     file** rather than applied to the only copy: re-kerning the wordmark is a
     brand decision, and Jabez is redrawing the logo anyway.
- Two traps worth remembering if this is touched again. **Kern before knocking
  out**: once the seams are transparent the ball is three separate shapes, and a
  gap-finder prises it apart at the seams. And **segment on solid ink**
  (alpha > 128, not > 8): at the r/i pair the anti-aliased edges touch, so a
  permissive threshold reads them as one glyph and the gap that needs opening
  isn't there to find. A first cut of the column-dropping range could also walk
  past the end of a wide run and eat into the next glyph — it now takes the middle
  `surplus` columns, and skips the runs at the image edges entirely.

**Tone-of-voice pass across the app + brand record (2026-07-30):**
- Trigger: Aidan updated the designer brief (`Jabez (App design) (1).docx`, in
  Downloads) and fixed the tone of voice at **Convenient · Reliable ·
  Inclusive**, asking that the whole app be about those three.
- ✅ `CLAUDE.md` now carries a **Brand voice** section — the three traits, a
  do/don't table, and the rules that fall out of them (no exclamation marks
  outside a genuine celebration; never state a rule the code doesn't enforce;
  state the mechanism rather than reassurance). This is the reference for any
  future copy, so the voice survives sessions and machines.
- ✅ Copy changed, by trait rather than wholesale rewriting — lines that already
  worked were left alone:
  - **Onboarding**: level question reframed ("you can change it any time") and a
    new line under the cards — "Not sure? Pick the closest one — plenty of games
    are open to all levels." Directly answers the interview finding that players
    can't rate themselves. "Let's go!" → "Start browsing games".
  - **Browse**: the empty state told people to widen filters they hadn't set —
    now two separate sentences for "no matches" vs "nothing posted yet". Empty
    Upcoming/Hosting/Past states say what to do next. The cold-start line
    "⏳ Waking up the server" is gone (never expose our plumbing).
  - **Game detail**: join and waitlist confirmations now say what happens next
    (email + day-before reminder; automatic promotion, no need to check back).
    The leave dialog states the participation rule, and computes whether *this*
    leave counts late by mirroring `hoursUntilStart()` + `LATE_LEAVE_HOURS` from
    `server/repo.js` — same UTC-naive parse, so UI and server can't disagree.
  - **Settings FAQ**: four new answers (beginners, participation rate, paying
    the host, joining) and two **factual corrections** — reviews open 2 h after
    a game (not "30 minutes"), and the comment is required, not optional.
  - **Reminder notification** now carries the time and venue: "Tomorrow at
    6:30 PM: "Friday Night Indoor 6s" · Bedok Sports Hall". `repo.js` imports
    `prettyTime` from `email.js` (no cycle — email.js imports nothing local).
  - **Emails**: join confirmation promises the day-before reminder; reset email
    explains the 1-hour single-use link and that nothing changed if it wasn't
    you. Also fixed two pre-rebrand colours still shipping — the reset button's
    Vybe coral `#E8734A` and the join email's cream `#f5ede3` body.
  - **Cost field** in the game form now says the price is shown before anyone
    joins and that players pay the host directly.
  - **Meta description** (index.html + PWA manifest) rewritten to carry all
    three traits.
- ✅ `Coterie-Business-Overview.docx` updated in place (Word opens it clean, 25
  pages): tone of voice replaced, brand attributes restated in Aidan's words
  (Convenient / Reliable / Abundant / Available 24/7, last two still flagged
  aspirational), audience made co-primary, positioning now says "networking app"
  and carries the appropriate-skill-level goal, the 8 tagline candidates + the 4
  shortlisted recorded, competitor list ranked by how players actually find
  games (adds ActiveSG Sports Interest Groups), global ambition noted, designer
  brief linked. Two stale claims corrected: the Highlights *feed* and the
  Settings *feedback form* no longer exist.
- Verified: `npx tsc --noEmit` clean, `npm run build` clean, and the changed
  server modules executed (not just `node --check`) to confirm the new import
  resolves and the reminder string renders.

**Boot splash no longer fetches its logo (2026-07-30):**
- Bug Aidan hit repeatedly: a **broken-image icon** where the bouncing ball
  should be, on load and again on reload.
- Root cause: the splash in `index.html` is painted before any JS runs, and its
  ball was `<img src="/logo-mark.png">` — a 74 KB network fetch. The service
  worker never precached that file (`includeAssets` listed only `favicon.svg`
  and `apple-touch-icon.png`, and there is no runtime rule for images), while
  the HTML itself *is* served from cache. So whenever the request failed —
  offline reload, flaky mobile, a cold Railway dyno — the page rendered fine and
  the logo rendered as the browser's broken-image glyph.
- ✅ Fix: the mark is now **inlined as a 128px base64 data URI** in
  `index.html`, so the splash makes no requests at all and cannot fail. 128px
  because it paints at 64 CSS px; the full 1024px artwork would put ~99 KB of
  base64 in front of first paint (this is ~5 KB).
- ✅ It is **generated, not hand-edited** — `scripts/gen-logo.mjs` step 7
  rewrites the region between the `<!-- splash-mark:start/end -->` markers, so a
  future logo change regenerates the splash too. The script throws if the
  markers are missing rather than silently skipping.
- ✅ `logo-mark.png` added to `includeAssets` so the SW precaches it for the two
  waitlist pages, which still render it via `<img src>` after the bundle loads.
- Verified from the built `dist/index.html` opened off the filesystem (zero
  network): the splash img decodes, `naturalWidth` 128, `complete` true.
- The preview fork's splash uses an inline SVG and it doesn't reference
  `logo-mark.png` anywhere, so it never had this bug — nothing to mirror.

**Participation restored to the rating block (2026-07-29):**
- Bug: every profile's rating card showed a bare **"—  PARTICIPATION"**. Not
  missing data — the header rebuild (above) stopped passing `participationRate`
  into `RatingHero`/`RatingEmpty` from `Profile.tsx` and `UserProfile.tsx`, but
  left the `ParticipationStat` block rendering inside them, so it fell back to
  the null dash on every profile while the header showed the real figure.
- **Decision reversed (Aidan's call):** participation *does* appear twice — once
  in the header stat row, once beside the stars. Both pages now pass the same
  `participationRate` value into the rating block, so the two can't disagree.
- The preview fork never took the header rebuild, so its pages already pass
  `participationRate` — no mirror needed for this fix.

**Demo data variation — participation, peer and host ratings (2026-07-29):**
- Problem: every demo profile read an identical **100% participation**; all five
  headline accounts sat between **4.59–4.64** peer rating with the same vote
  count; host ratings clustered **4.69–4.85**; and **24 supporting accounts had
  no ratings at all** despite 20+ past games. Uniform data makes a stat look
  decorative rather than real.
- ✅ `game_dropouts` is now seeded: each demo player gets a target from
  `PARTICIPATION_TARGETS` and enough late bails to land near it. Bails are
  recorded **only on past games the player is not on the roster of** — the
  truthful shape (they left, so they aren't a member) and it avoids counting one
  game as both attended and bailed, which would understate the rate.
- ✅ Peer ratings: a per-player target average with ±1 jitter per vote, replacing
  one shared `pattern` array reused for everybody. Supporting cast (`user_p*`)
  now receive 5–12 votes each.
- ✅ Host reviews: per-host target from `HOST_RATING_TARGETS`, replacing
  "5 unless hash, then 4".
- ✅ Result: participation **76–100%**, peer **3.60–4.70**, host **3.81–4.58**,
  and zero demo accounts without a rating.
- **`SHOWCASE_USER` (`user_maria` / 1@demo.test) is pinned** to 97% / 4.7 / 4.8.
  The hash had by chance given the primary demo login the worst numbers of the
  entire cast — a poor account to walk someone through the app on.
- Content changes here need the old rows cleared first, since
  `ON CONFLICT DO NOTHING` never updates: delete `pr_show_%` / `rev_seed_%`,
  then re-run `seedPastData()` + `seedEngagement()`.
- **Incident (second of this kind):** the `SHOWCASE_*` constants were first
  declared beside the other tuning constants, *below* the `demoShowcaseRatings`
  IIFE that reads them. `const` is not hoisted the way a function declaration
  is, so the module threw `ReferenceError: Cannot access 'SHOWCASE_USER' before
  initialization` at import. Caught before deploy this time by **executing** the
  module, not just running `node --check` — see
  [verify-server-code-before-deploy].

**Demo engagement data — rosters, chat, comments, reviews (2026-07-27):**
- Problem: the app read as empty. 75 of 92 games had only the host on the
  roster, `game_comments` and `game_interest` were 0 rows, `messages` was 5,
  `game_reviews` 13, and all 29 demo accounts shared one "member since" date
  (2026-06-13) because they were inserted in a single seeding run.
- ✅ New `seedEngagement()` in `server/seed.js`, called from `start()` after
  `seedPastData()` and from the admin `POST /api/admin/seed-past-data`. It
  reads whatever demo-hosted games exist rather than listing them statically —
  most games have random ids and can't be hardcoded. Idempotent (row ids
  derived from game id + index) and deterministic (content picked by hashing
  that id), so re-running on every boot inserts nothing new and never reshuffles.
- ✅ What it fills: roster spots to 50-90% of each game's slots (~618),
  pre-game chat threads that build over the days before a game plus a wrap-up
  after (~612), public Q&A comments (~261), host reviews from ~2/3 of players
  on finished games (~349), and stars on upcoming games (~16). Demo
  `created_at` backdated 6-20 months (staggered per account) so profiles show
  real tenure.
- ✅ Message/comment/review authors are restricted to `@demo.test` accounts.
  Three real testers are members of demo-hosted games — authoring invented
  chat or reviews in their names would be misattribution, so `demoSet`
  filters them out of the author pool (they can still be on the roster).
- Timestamps that would land in the future are skipped, so far-off games are
  naturally quiet and past games have full threads — no per-game tuning.
- Cleanup at launch is unchanged: these rows are demo-account-owned or carry
  `msg_seed_` / `cmt_seed_` / `rev_seed_` id prefixes, so the existing
  "SEED_DEMO=false + delete demo rows" plan (task #3) still covers them.
  Those prefixes also make the content re-seedable: `DELETE ... WHERE id LIKE
  'msg_seed_%'` then re-run, which is how the dialogue fix below was applied
  (ON CONFLICT DO NOTHING means edits never overwrite existing rows).
- Follow-up fix: questions and answers were drawn from independent pools, so
  threads produced "Is it indoor shoes only?" → "All levels welcome!". Chat and
  comments now use paired Q&A entries, and repeated player lines within one
  thread are avoided by stepping through the pool (coprime stride) instead of
  hashing each pick independently.
- **Incident (same day):** removing the created_at floor left two stale
  `createdMs` references, so `seedEngagement()` threw ReferenceError, `start()`
  aborted, and production crash-looped until the fix shipped. `node --check`
  passed — it is a runtime error, not a syntax one. Seed functions are now
  executed against a real database before deploying, not just parsed.

**"googleform" added as a recognized waitlist channel (2026-07-27):**
- ✅ Investigated why "Pageviews by source" showed 9 googleform-tagged visits
  but "Signups by source" showed 0: `WAITLIST_SOURCES` (`server/index.js`)
  never included `googleform`, so `normaliseWaitlistSource` silently collapsed
  any real googleform-attributed signup into the generic "Other" bucket
  (2 signups, all time), discarding the original tag. Cross-referencing the 2
  "Other" signups' timestamps against PostHog's googleform-tagged pageviews
  found both landed 5-7 seconds after one — strong evidence both were real
  googleform signups that got miscategorized, not a broken event.
- ✅ Fixed going forward: `googleform` added to `WAITLIST_SOURCES` (server) and
  `SOURCE_LABELS` ("Google Form", `src/admin/pages/Funnel.tsx`), so future
  signups from that link show up as their own row.
- Decided NOT to backfill the 2 historical "Other" rows — the timing match is
  strong circumstantial evidence but not certain, and Aidan chose to leave
  history as-is rather than rewrite stored signup data on that basis.

**Profile edit entry point consolidated to the cover-photo pencil icon (2026-07-27):**
- ✅ `src/pages/Profile.tsx`: the full-width red "Edit profile" button below the
  skill badge is gone. The pencil icon top-right on the cover photo (which used
  to toggle an in-place banner color/image picker) now opens the same full
  edit screen the button used to. The banner color/photo picker itself moved
  into that edit screen (new "Change cover" toggle right below the avatar
  upload) so it's still reachable, just consolidated into one place instead of
  two separate editing surfaces.
- Bug caught and fixed during the move: the cover-photo cropper modal
  (`BannerCropper`) only rendered in the view-mode JSX branch. Since edit mode
  is an early `return` before that branch, moving the cover picker into edit
  mode without also moving the cropper would have made "Insert your own image"
  silently do nothing while editing. Cropper now renders in both branches.

**Per-video waitlist tracking in the admin dashboard (2026-07-27):**
- ✅ Signups by video is now authoritative in the DB, mirroring the existing
  signups-by-source pattern: `waitlist.campaign` column (`server/db.js`),
  captured from `?utm_campaign=` on the waitlist page the same way `source`
  captures `utm_source` (`WaitlistDesktop.tsx`/`WaitlistMobile.tsx` →
  `POST /api/waitlist` → `repo.addWaitlistEntry`). Freeform, unlike `source` —
  no fixed allowlist, since any number of videos get posted over time. Excludes
  `source='test'` rows at the query level (`repo.getWaitlistCountsByCampaign`)
  since a test signup's campaign value can't be isolated afterward the way the
  by-source breakdown isolates its own `'test'` bucket.
- ✅ Pageviews by video added via a new PostHog query grouped on the `video`
  super property (`server/posthog.js: queryWaitlistVisitsByVideo`), same
  `SINCE_UTM_FIX` cutoff as pageviews-by-source.
- ✅ Both surfaced in `src/admin/pages/Funnel.tsx` as two new cards reusing the
  existing `SourceBarChart` component (same highest→lowest sort, same visual
  style as the by-source charts) — no new chart component needed.
- ✅ Video names are whatever string is used in the link's `utm_campaign` —
  e.g. `introduction`, `volleyball` — same as PostHog's `video` property, no
  transformation/allowlist either side, so both stay in sync automatically.
- Not yet done: mirroring the capture side to `coterie-prototype` (task #20).

**Favicon white-border fix (2026-07-27):**
- ✅ `scripts/gen-logo.mjs`: the 2026-07-26 black-square fix (commit `4a9aa94`) put
  every icon — including the browser-tab favicon — on a padded white tile, to stop
  iOS rendering `apple-touch-icon.png`'s transparency as opaque black on
  "Add to Home Screen". That fix was correct for `apple-touch-icon.png`,
  `pwa-192x192.png`, `pwa-512x512.png`, `maskable-512x512.png` (all still keep the
  white tile), but browser tabs don't have iOS's compositing problem — the white
  tile just showed up as a visible white border around the mark, unlike every
  other site's tab icon. `favicon-32x32.png` and `favicon.svg` reverted to a plain
  transparent downscale of the mark (their pre-`4a9aa94` form) — regenerated via
  `node scripts/gen-logo.mjs`.

**Waitlist page rebranded to Coterie red (2026-07-23, both apps):**
- ✅ `WaitlistDesktop.tsx` + `WaitlistMobile.tsx`: "vybe" → "Coterie"; entire blue
  palette swapped to luminance-matched reds (brand `#D92632` / dark `#B31E29`,
  tints `#E4535D`→`#F5B6BA`, warm-tinted whites/borders, mobile dark hero warmed
  from blue-slate to red-tinted darks). Social proof copy now "100+ players
  already on the list" (was 40+) — per Aidan, waitlist-page-only claim.
- ✅ `server/email.js`: footer wordmark VYBE → COTERIE; email accent `brand` was a
  stale orange `#E8734A`, now brand red `#d92632`.
- ✅ `src/admin/admin.css` comment renamed (admin deliberately KEEPS the blue theme).
- ✅ Mirrored 1:1 into `coterie-prototype` (incl. its ICS `UID:@vybe` → `@coterie`).
- Left alone on purpose: internal storage keys `vybe.welcomed`,
  `vybe:last-chunk-reload`, dev-only `vybe-admin-dev-secret-change-me` — renaming
  would re-trigger the welcome modal for existing testers for zero user-visible gain.

**Customer discovery dashboard (2026-07-23):**
- ✅ `Coterie_Interview_Dashboard.xlsx` (30 interview writeups + live-formula
  dashboard + charts) moved from the OneDrive `Claude/` folder into this repo so it
  syncs across both machines. Dashboard sheet reflowed from one 132-row strip into
  a two-column layout (left A–D / right F–I, notes in their own column, full-width
  banners); chart data labels fixed — pies show percent-only, bars value-only (was
  "Series1; category; value; %" overlapping spam). Chart refs remapped to moved
  tables; all formulas recalc clean in Excel. Note: Excel COM crashes saving
  directly to the OneDrive path — edit via openpyxl or save through a temp copy.

**Security hardening (verified in code, 2026-07-20):**
- ✅ SQL injection closed — every query in `repo.js` is parameterized (`$1`, `$2`).
- ✅ Server **refuses to boot** on a missing/placeholder `JWT_SECRET` (`auth.js:26`),
  and fails closed unless `NODE_ENV` is explicitly `development`/`test`.
- ✅ `trust proxy` set to `1`, not `true` (`index.js:58`) — prevents IP spoofing that
  would bypass every rate limiter.
- ✅ Token revocation via `token_version` — password reset / suspension kills live
  sessions immediately (`auth.js:78`).
- ✅ Constant-time login (`TIMING_HASH`, `auth.js:11`) — blocks user enumeration.
- ✅ Helmet CSP + HSTS, shared by both apps (`server/security.js`).
- ✅ Rate limiting on login, signup, password reset, and all `/api`.
- ✅ 100 KB JSON body cap; bcrypt password hashing.
- ✅ Join race condition fixed with `SELECT … FOR UPDATE` in a transaction
  (`repo.js:851`) — covered by `tests/join-race.test.js`.
- ✅ Ownership checks confirmed present on `updateGame` (`repo.js:1009`),
  `deleteGame` (`repo.js:1091`), `cancel-series` (`index.js:681`).
- ✅ `optionalAuth` deduplicated (2026-07-20): there were two — a weak sync one
  exported from `auth.js` and a correct async one defined privately in `index.js`.
  The correct implementation now lives in `auth.js` and `index.js` imports it, so
  suspended and revoked sessions are treated as anonymous on public reads and there
  is no weaker copy to import by accident. Covered by `tests/auth.test.js`.
- ✅ `npm audit` run 2026-07-20: **no production dependencies are vulnerable**
  (express, pg, bcryptjs, jsonwebtoken, helmet, zod, react all clean). All 5
  findings are dev-only — see §4 #5.
- ✅ Cloudinary uploads switched from unsigned preset to server-signed.
- ✅ Committed `JWT_SECRET` scrubbed from `DEPLOY.md`; **live secret already rotated.**
- ✅ `.env` is gitignored and untracked — only `.env.example` / `.env.admin.example`
  are committed.

**Admin suite — all 3 phases done, deployed 2026-06-24:**
- ✅ Phase 1: expanded analytics (new 7d/30d, suspended, highlights, comments, 8-week
  signups chart), user management (search, suspend/unsuspend, remove), content
  moderation. `users.suspended` blocks login / `/auth/me` / Google callback. Admin
  accounts protected from self-lockout.
- ✅ Phase 2: feedback inbox (`feedback.resolved`) + append-only audit log
  (`admin_audit` + `logAdminAction`) recording every admin mutation with actor.
- ✅ Phase 3: reports queue (`reports` table, `ReportButton` on highlights/comments/
  games) + feature flags (`feature_flags`: `maintenance_mode`, `signups_enabled`;
  `GET /api/config` + `useAppConfig` 30 s poll; maintenance middleware 503s non-admins).
- Admin sign-in is a single shared bcrypt password (`ADMIN_PASSWORD_HASH` +
  `ADMIN_LOGIN_EMAIL=aidan.chongjh@gmail.com`), rate-limited 5 fails/15 min/IP. It
  unlocks a session for that existing user row, so suspension/roles/audit still apply.
  Google OAuth for admin was deliberately dropped 2026-07-07.
- Deferred / possible next: broadcast announcements, 2FA, granular roles.

**Infrastructure:**
- ✅ Idle pg pool-client errors handled — a dropped DB connection no longer crashes
  the process (`db.js:49`).
- ✅ GitHub Actions CI: type-check, tests, build.
- ✅ 14 test files in `tests/`.
- ✅ Sentry (front + back), PostHog analytics, Resend email, Cloudinary media.
- ✅ Admin app split into its own Railway service with its own JWT + capped DB pool.
- ✅ Build SHA exposed at `/healthz`; UptimeRobot pings it to reduce cold starts.

**Loader ball seams made symmetric (2026-07-23, BOTH apps):**
- The volleyball's six seam paths all radiated from a hub at (70,58) toward
  the LEFT side only — one pinwheel arm was effectively missing (Aidan
  spotted it). Rebuilt as ONE arm (2 paths) in `<defs>` reused via
  `<use transform="rotate(120/240 60 60)">`, so 3-fold symmetry is
  structural, not hand-drawn. Applied in `index.html` splash +
  `FullScreenLoader.tsx` in both apps; design verified by rendering to PNG
  with sharp before shipping.

**Loader ball squash removed (2026-07-23, BOTH apps + admin.css):**
- The bouncing-ball loader's impact squash (`scaleX(1.18) scaleY(0.82)`)
  read as a broken oval ball in stills — Aidan flagged it. Keyframes in
  `index.html` (splash), `src/index.css` (ball-bounce), and the frozen
  `src/admin/admin.css` now animate translateY only; the ball stays a
  perfect circle. Mirrored to the preview fork and deployed.

**Main app rebranded to Coterie — preview frontend adopted (2026-07-23):**
- Copied the preview fork's entire frontend into the main app: red brand
  `#d92632`, light theme (slate-scale inversion in `src/index.css`), BrandMark
  logo (red tile + white C), desktop header nav + 2-col browse grid, neutral
  badges, white splash/manifest, Chats bottom tab.
- **Removed to match the preview exactly** (Aidan's explicit choice):
  Marketplace (pages + mock catalog + art), highlight *posting*
  (HighlightUploadModal, "+ Add", post-sheet entry — viewing stays), Settings'
  Help & Support forms and Sounds & haptics toggles. Note: in-app
  feedback/bug-report submission is gone with Help & Support; the admin
  feedback inbox still works for old rows.
- **Vybe → Coterie everywhere**: UI strings, index.html/meta, PWA manifest
  (name "Coterie — Find your players", white theme), emails (`server/email.js`
  incl. MAIL_FROM default), maintenance message, ICS PRODID/UID, share/OG
  text, admin heading. ⚠️ Railway env `MAIL_FROM` may still say "Vybe" —
  Aidan must update it in Railway Variables.
- **All PNG icons regenerated red** via rewritten `scripts/generate-icons.mjs`
  (BrandMark-based: pwa-192/512, maskable, apple-touch, favicon-32, og-image).
  The preview fork still has the old blue PNGs — regenerate there if wanted.
- **Admin app keeps its dark/blue theme**: old `index.css` preserved as
  `src/admin/admin.css`, `src/admin-main.tsx` imports it. Admin is otherwise
  untouched (build passes).
- Verified: `npm run build` (consumer + admin) clean, 101 tests pass, local
  Vite smoke test shows white/red Coterie auth page.

**Demo data localized to Singapore (2026-07-23, BOTH main app and preview fork):**
- All seed data moved from LA to Singapore: SG names (mostly Chinese, some
  Malay/Indian — main 5 are now Jia Min T. / Wei Jie L. / Nur Aisyah B. /
  Arjun N. / Hui Wen O., same 1–5@demo.test logins), real venues (ActiveSG
  sports halls, OCBC Arena, Siloso/Tanjong Beach Sentosa, West/East Coast
  Park), SG neighborhoods as home areas, realistic titles ("Friday Night 6s
  @ Bedok"). Touched: `server/seed.js`, `src/pages/Auth.tsx` (demo login
  list), `src/lib/marketplace.ts` (sellers + court listings, SG-ish prices),
  `src/components/GameForm.tsx` placeholder, `store-assets/*.mjs`, CLAUDE.md.
- **New `syncDemoData()` in seed.js, runs every startup** (wired in
  `start()`): UPDATEs existing demo rows (users + demo games by static id)
  in place, since `seedIfEmpty` never re-runs on a populated DB.
  `seedPastData` games/reviews became upserts for the same reason. p0–p23
  demo emails migrate too (e.g. jordan@ → junwei@demo.test); password sync
  is unchanged. Note: only game_demo_1–5 still exist in prod (6–10 were
  deleted at some point) — the sync respects deletions, updates only.
- Six older screenshot-script games (random ids, US venues) were patched
  live via the API as their demo hosts after deploy. Live data on BOTH apps
  verified clean of US references 2026-07-23.
- Preview fork mirrored (seed.js ported with its shiftDate kept, index.js
  wiring, Auth demo list, placeholder, types comment) and deployed via
  `railway up --service web --ci`.

**Game-form changes (2026-07-22, in BOTH main app and preview fork):**
- Gender options: "Mixed" removed from the form (server still accepts it so old
  games stay editable). Net height "Recreational (2.35m)" renamed to
  "Mixed (2.35m)" (server accepts both).
- New skill scale, All Levels first: All Levels, Low Beginner, High Beginner,
  Low Intermediate, High Intermediate. Legacy Beginner/Intermediate/Advanced
  remain in types + server allowlist for existing data. Applied to GameForm,
  Profile editor, Browse filters, Onboarding cards, Badges/SKILL_INFO maps.
- Date validated end-to-end: client min/max (+366 d) + submit check; zod refine
  rejects unparseable dates and anything outside ~1 year ahead (kills "22222").
- Positions: "Any" moved first and selected by default.
- "Area / neighborhood" field removed from the form; area falls back to the
  venue string server-side, and cards/detail hide area when it repeats location.

- Follow-up 3 (2026-07-22): bottom-tab highlight now persists on deep routes in
  BOTH apps (/game/* lights Browse, /user/* lights Profile) — main app included.
  PREVIEW-ONLY: Settings loses Help & Support + Sounds & haptics (re-addable
  later); new crisp BrandMark logo (red tile + white C) in header and
  favicon.svg; splash/loader ball flattened (gradient + highlight smudge
  removed). Main app Settings/branding untouched.
- Follow-up 2 (2026-07-22, both apps): filter panel loses the "Venue standard"
  net-height chip and the entire Region (N/S/E/W) section. Host form keeps Venue
  standard as its default net height.
- Follow-up (2026-07-22, both apps): host kick removed — roster/waitlist X buttons
  gone and the /members/:id/remove endpoint deleted (promote kept). "Advanced"
  restored as the top skill grade (after High Intermediate). Filter panel now
  mirrors the host form: same net-height values (Rec -> "Mixed (2.35m)", matches
  legacy Recreational too), same position list (full names, no DS), gender
  ("Who it's for") filter removed, dual-range time slider replaced with From/To
  time inputs. New /interested page (games you starred) + star button in the
  header next to Settings.

**Coterie Preview prototype (2026-07-22) — now a FULL-APP FORK:**
- ✅ Rebuilt same day at Aidan's request: the minimal prototype was replaced with a
  **near-exact copy of the main app** (auth + demo one-tap login, browse tabs,
  search/filters, full GameForm, game detail, chats, notifications, profiles,
  ratings, settings). Removed: **Marketplace**, **highlight posting**, admin app.
- Theme flipped to light/white with **red** brand (#d92632) centrally in
  `src/index.css`: slate color scale inverted via `@theme` + `.text-white` remap —
  component classNames untouched, so main-app changes can be re-merged easily.
- Fork deltas: seed demo-game dates shift relative to today (`shiftDate` in
  seed.js); Market tab → Chats tab; post sheet has only "Post a game"; light
  splash/PWA manifest; blue hexes recolored red.
- 2026-07-22 later-3: preview renamed Vybe -> Coterie everywhere user-facing; desktop header nav enlarged (18px); Browse/Upcoming/Hosting/Past switcher reverted to compact.
- 2026-07-22 later-2: browse desktop polish — games-count moved out of the grid (was eating a card slot), Host button moved from header to the page heading row, view tabs enlarged on lg.
- 2026-07-22 later: desktop layout added (header nav + 2-col browse grid on lg,
  bottom tabs mobile-only); type/skill badges neutralized (color only for spots
  status + brand). Custom domain **preview.coterie.com.de** created on the Railway
  service; waiting on Aidan to add the CNAME + TXT records at **Porkbun** (DNS host
  for coterie.com.de) — records are in the coterie-prototype README… see chat.
- Same live URL + repo as below. Local dev `.env` points DATABASE_URL at the
  preview project's Railway Postgres public URL (no local DB).

**(Superseded same day — original minimal prototype:)**
- ✅ Built a standalone no-login demo of the core loop (browse → detail → host →
  join/leave) in a **separate sibling repo**: `../coterie-prototype` (own git repo,
  not part of this one). Purpose: something simple Aidan can show/demo on the web.
- Design: light mode / white bg, **red** brand `#d92632` replacing blue, **green**
  `#16a34a` for success states only. Mobile-first (FAB on phones), responsive
  multi-column on desktop. Branded "coterie PREVIEW".
- Identity: display name asked on post/join, kept in localStorage; "Continue as
  demo player" one-tap fallback. No accounts, deliberately no edit/delete endpoints.
- Stack mirrors main app (React 18 + TS + Vite 6 + Tailwind 4 + Express 4).
  `server/db.js` runs on Postgres when `DATABASE_URL` is set, in-memory otherwise
  (local dev needs no DB). Server-side validation, strict id regex, per-IP rate
  limits (20 writes/10 min), 10 kB body cap, security headers, transactional
  capacity check. Verified end-to-end in browser + curl probes 2026-07-22.
- ✅ Deployed 2026-07-22: GitHub repo `aidancjh/coterie-prototype` (private),
  Railway project `coterie-preview` (service `web` + Postgres),
  **live at https://web-production-e0326.up.railway.app**. Railway CLI now
  installed + authed on the PC. GitHub repo is NOT connected to Railway
  (app lacked repo access) — deploys go via `railway up --service web --ci`
  from the prototype folder, pushes do not auto-deploy.
- Emoji icons replaced with stroke-only SVG line icons (2026-07-22).
- Side change in THIS repo: `.claude/launch.json` gained `coterie-preview-api` /
  `coterie-preview-web` entries for local preview.

---

## 6. How Aidan works — standing preferences

These apply on **both** machines and to every session. (Claude Code's per-machine
memory lives in `C:\Users\aidan\.claude\` and does **not** sync between devices —
it holds credentials and ~145 MB of session data, so it must not be put in OneDrive.
This section is the portable copy. Keep it current.)

- **Always commit and push to `main` after a change, without being asked.** Railway
  auto-deploys on push (~2 min) and that is the only way Aidan can test — he uses the
  production PWA at coterie.com.de installed on his phone, not a local dev server.
  A fix that lives only locally reads as "still broken" to him.
- **After a PWA change, remind him to fully close and reopen the app** (with network)
  so the service worker picks up the new version.
- **Claude has no access to Railway.** Anything involving env vars, services, or the
  database dashboard is Aidan's step — give him an exact, copy-pasteable checklist.
- **Never ask for, store, or use his account password.** He has offered it before; it
  was declined and must stay declined.
- **Cold starts** are currently mitigated by an UptimeRobot ping to `/healthz` every
  ~5 min (Aidan configured it). Replace with paid always-on Railway at launch — §4 #8.
- **He is a non-engineer.** Explain the why, not just the what. He is hiring software
  engineers for the code review — prepare scope for them rather than doing it unasked.
- **Keep the business overview doc current — unprompted, on either machine.** It lives at
  `C:\Users\aidan\OneDrive - Soul ways\Claude\Coterie-Business-Overview.docx` (one level above
  this repo; OneDrive syncs it between machines). Whenever the product, plans, traction, or
  context change, update the docx in the same session. Fully rewritten 2026-07-22; renamed
  from Vybe-Business-Overview.docx and rebranded 2026-07-23 to match the app-wide Coterie
  rebrand (doc accent color now Coterie red; marketplace-preview and highlights-feed
  references removed to match the adopted frontend). Standing content decisions: product
  name is Coterie everywhere; Singapore-only, volleyball-only (SEA
  years out, only if very successful locally); **no Financials section** (removed at Aidan's
  request); future features (marketplace, in-app payments, live scorecard, coaching) are
  explicitly gated behind perfecting the host/join core loop; waitlist is ~73 —
  62 Reddit / 7 Telegram / 4 Instagram, founder-reported 2026-07-22, driven by two
  r/SGVolleyball problem-posts with 50k+ combined views; the doc has a
  "Singapore scene on the ground" market section (founder interview 2026-07-22:
  40–60 games/wk, Telegram listing vignette, ~half of games see no-shows, ~90% pay
  after, $5–$10/player, age-segregated crews; verified: 24 ActiveSG volleyball venues,
  14-day ballot mechanics, OCBC ~S$15/hr, Haikyu growth effect, no volleyball-native
  SG competitor as of Jul 2026); the doc ends with a "What's Missing — Three
  Lenses" (engineer / business / investor) section that should be kept current as items
  get resolved.

---

## 7. How to work on this project

**Every session, on either machine:**

1. `git pull` **before** starting work.
2. Read this file. It is loaded automatically via `CLAUDE.md`.
3. Do the work.
4. **Update this file in the same turn** — move tasks between §4 and §5, add
   decisions to §3, refresh the header date/branch/head.
5. Commit code + this file **together**, then `git push` (deploys in ~2 min).

**Why git and not OneDrive:** OneDrive syncs on a delay and can create conflict
copies of files being edited on two machines. Git is deterministic and gives an
audit trail. Pull first, push last — that is the whole protocol.

**The repo currently lives inside OneDrive**, which works but carries three risks:
1. Conflict copies of edited source files (hence the `*-aidan.*` rule in `.gitignore`).
2. `node_modules` — hundreds of MB of machine-specific compiled binaries (`sharp`,
   `esbuild`) that OneDrive syncs pointlessly and can corrupt across machines.
3. **`.git` itself** — if OneDrive syncs it mid-write, or reconciles two machines'
   versions, the repo can be corrupted. This is the one that loses work.

Rules while it stays in OneDrive: never open the project on both machines at once;
wait for OneDrive to show "Up to date" before switching; exclude `node_modules`,
`dist`, `dist-admin`, and `.vite` from sync.

**Clean fix (do this when setting up staging):** move the repo out of OneDrive (e.g.
`C:\dev\Volleyball-Claude`) and clone from GitHub on each machine — git handles sync
entirely and the whole risk class disappears. One-time cost: copy `.env` to each
machine by hand, since it isn't in git.

**Update triggers — update this file whenever anything is:**
added · removed · changed · decided · reversed · completed · deferred · discovered.

Pure Q&A sessions with no change to the project do **not** need an update. The file
must stay trustworthy; noise makes it ignorable.
