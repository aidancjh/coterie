// Pre-launch access gate — keeps the app private while the waitlist stays public.
//
// Turned on with `APP_PRIVATE=true` + `APP_ACCESS_PASSWORD=<12+ chars>` on the
// consumer service. Misconfiguration FAILS CLOSED: setting APP_PRIVATE without a
// usable password aborts startup rather than quietly booting the site public,
// for the same reason auth.js refuses to start on a weak JWT_SECRET — the
// dangerous outcome here is believing you are private when you are not.
//
// What stays PUBLIC with the gate on:
//   /waitlist, /privacy   the pre-launch landing pages
//   /api/waitlist         so signups (and their utm attribution) keep flowing
//   /api/config           the tiny public flag payload the client boots with
//   /healthz              UptimeRobot pings this; gating it would turn the
//                         lockdown into a false "site down" alert
//   /unlock, /robots.txt  the gate's own door and its crawler instructions
//   /assets/* + root-level static files — the waitlist is part of the same SPA
//                         bundle, so its JS/CSS/icons must load
//
// Everything else — `/auth`, `/game/:id`, and the rest of `/api` — needs the
// unlock cookie. `/` is special-cased to REDIRECT to the waitlist instead of
// showing a password prompt, so a stranger arriving at coterie.com.de sees a
// deliberate pre-launch page rather than a locked door.
//
// The admin app is a separate Railway service with its own entry point
// (`admin-server.js`), so it never passes through this middleware.
import crypto from "node:crypto";

const COOKIE = "coterie_access";
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days — long enough that a phone
// used for testing is not re-prompted mid-session, which matters because an
// installed PWA has no address bar to comfortably re-enter a password in.

// A shared secret protecting a whole environment; short ones are guessable
// offline if the cookie format is ever known, so refuse them outright.
const MIN_PASSWORD_LENGTH = 12;

// Same reasoning as auth.js: Railway does not guarantee NODE_ENV="production" at
// runtime, so a check written as `=== "production"` silently does nothing on a
// real deploy. Require an explicit development/test opt-out instead.
const IS_DEV_OR_TEST =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

const wanted = process.env.APP_PRIVATE === "true";
const password = process.env.APP_ACCESS_PASSWORD || "";

if (wanted && password.length < MIN_PASSWORD_LENGTH && !IS_DEV_OR_TEST) {
  console.error(
    `[gate] FATAL: APP_PRIVATE=true but APP_ACCESS_PASSWORD is missing or shorter ` +
      `than ${MIN_PASSWORD_LENGTH} characters. Refusing to start, because booting ` +
      `would serve the whole app publicly while the dashboard says it is private. ` +
      `Set a strong password — generate one with ` +
      `\`node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"\` ` +
      `— or remove APP_PRIVATE to go public deliberately.`
  );
  process.exit(1);
}

/** True only when the gate is fully configured. Exported so index.js can skip
 *  mounting the /unlock routes entirely when it's off. */
export const gateEnabled = wanted && password.length >= MIN_PASSWORD_LENGTH;

// Cookies carry `<expiresAt>.<hmac>` — never the password. The expiry is inside
// the signed payload, so it is enforced by this server rather than trusted from
// the browser's own cookie lifetime (which a client controls and can extend).
// Changing either APP_ACCESS_PASSWORD or JWT_SECRET invalidates every issued
// cookie at once; that is the only revocation a single shared secret can offer.
const KEY = process.env.JWT_SECRET || "dev";

function sign(expiresAt) {
  const mac = crypto
    .createHmac("sha256", KEY)
    .update(`${password}.${expiresAt}`)
    .digest("hex");
  return `${expiresAt}.${mac}`;
}

/** Constant-time compare of two strings of possibly different length. */
function sameSecret(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  // timingSafeEqual throws on a length mismatch, so check lengths first. The
  // length of a secret is not itself sensitive here.
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function isValidToken(value) {
  const dot = String(value).indexOf(".");
  if (dot === -1) return false;
  const expiresAt = Number(String(value).slice(0, dot));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  return sameSecret(value, sign(expiresAt));
}

const PUBLIC_EXACT = new Set([
  "/",            // handled separately below — redirected, not blocked
  "/waitlist",
  "/privacy",
  "/healthz",
  "/unlock",
  "/robots.txt",
]);

// /api/unlock is the same password page as /unlock, reachable through a stale
// service worker (workbox's navigation route denylists /api, so it always hits
// the network). Public for the same reason /unlock is — it IS the door.
const PUBLIC_PREFIX = ["/api/waitlist", "/api/config", "/api/unlock", "/assets/"];

// Root-level static files the PWA and the waitlist need: /sw.js, /registerSW.js,
// /manifest.webmanifest, /favicon.svg, /pwa-192x192.png, /apple-touch-icon.png,
// /logo-mark.png … Deliberately one path segment and a known extension rather
// than "anything containing a dot", so a crafted path can't widen the allowlist.
const PUBLIC_FILE =
  /^\/[A-Za-z0-9._-]+\.(js|css|map|png|jpg|jpeg|svg|ico|webmanifest|json|txt|webp|woff2?)$/;

function isPublicPath(p) {
  if (PUBLIC_EXACT.has(p)) return true;
  if (PUBLIC_PREFIX.some((x) => p === x || p.startsWith(x))) return true;
  return !p.startsWith("/api") && PUBLIC_FILE.test(p);
}

function hasAccess(req) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== COOKIE) continue;
    try {
      return isValidToken(decodeURIComponent(part.slice(eq + 1).trim()));
    } catch {
      return false; // malformed percent-encoding in a hand-edited cookie
    }
  }
  return false;
}

/** Password check for POST /unlock. */
export function checkPassword(candidate) {
  return gateEnabled && sameSecret(candidate || "", password);
}

/** Issue the access cookie after a correct password. */
export function grantAccess(res) {
  res.cookie(COOKIE, sign(Date.now() + TTL_MS), {
    httpOnly: true, // not readable by JS, so an XSS can't exfiltrate the token
    // Not `NODE_ENV === "production"`: Railway may not set it, and getting this
    // wrong would send the cookie over plain HTTP. Same opt-out as above.
    secure: !IS_DEV_OR_TEST,
    sameSite: "lax",
    maxAge: TTL_MS,
    path: "/",
  });
}

/** The password prompt. Deliberately a plain server-rendered form with no JS and
 *  no bundle dependency, so it works even when everything else is blocked. */
export function unlockPage(error = "") {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Coterie</title>
<style>
  :root { color-scheme: light }
  * { box-sizing: border-box }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#fff; color:#1e293b;
         font:16px/1.5 "Public Sans", system-ui, -apple-system, sans-serif; padding:24px }
  .card { width:100%; max-width:340px; text-align:center }
  h1 { margin:0 0 4px; font-size:28px; letter-spacing:-.02em; color:#d92632 }
  p  { margin:0 0 24px; color:#64748b; font-size:14px }
  input { width:100%; padding:12px 14px; font-size:16px; border:1px solid #cbd5e1;
          border-radius:10px; margin-bottom:10px }
  input:focus { outline:2px solid #d92632; outline-offset:1px; border-color:#d92632 }
  button { width:100%; padding:12px 14px; font-size:16px; font-weight:600; color:#fff;
           background:#d92632; border:0; border-radius:10px; cursor:pointer }
  .err { color:#d92632; font-size:14px; margin:0 0 12px }
  .alt { margin-top:20px; font-size:14px }
  .alt a { color:#64748b }
</style>
</head><body><div class="card">
  <h1>Coterie</h1>
  <p>Not open yet — we're still building.</p>
  ${error ? `<p class="err">${error}</p>` : ""}
  <form method="POST" action="/unlock">
    <input type="password" name="password" placeholder="Access password"
           autocomplete="current-password" autofocus required>
    <button type="submit">Enter</button>
  </form>
  <p class="alt"><a href="/waitlist">Join the waitlist and we'll email you when it opens →</a></p>
</div></body></html>`;
}

/** The gate itself. Mount with `app.use(accessGate)` before any routes. */
export function accessGate(req, res, next) {
  if (!gateEnabled) return next();

  const p = req.path;

  // The landing page belongs to the waitlist while we're private. Anyone
  // holding the cookie carries on into the app as normal.
  if (p === "/") {
    if (hasAccess(req)) return next();
    return res.redirect(302, "/waitlist");
  }

  if (isPublicPath(p) || hasAccess(req)) return next();

  res.set("X-Robots-Tag", "noindex, nofollow");

  if (p.startsWith("/api")) {
    return res
      .status(401)
      .json({ error: "Coterie isn't open yet.", locked: true });
  }

  // Never let a navigation to a gated page sit in the PWA's page cache.
  res.set("Cache-Control", "no-store");
  return res.status(401).type("html").send(unlockPage());
}
