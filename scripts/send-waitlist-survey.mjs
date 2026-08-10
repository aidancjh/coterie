/**
 * One-off: send the waitlist problems-survey email in daily batches.
 *
 * Resend's free tier allows 100 emails/day, so the 400-person waitlist goes out
 * over four runs. The script is resume-safe: every address it successfully sends
 * to is appended to the send log immediately, and every run skips everything
 * already in that log. Re-running can never double-send.
 *
 * The log lives OUTSIDE this repo, in OneDrive:
 *   ~/Library/CloudStorage/OneDrive-Soulways/Claude/waitlist-send-log.csv
 * Two reasons: it holds 400 real email addresses and must not be committed to
 * GitHub, and OneDrive syncs it between machines so tomorrow's run sees today's.
 *
 * Usage:
 *   node scripts/send-waitlist-survey.mjs              # dry run, sends nothing
 *   node scripts/send-waitlist-survey.mjs --send       # actually sends
 *   node scripts/send-waitlist-survey.mjs --send -n 25 # smaller batch
 *   node scripts/send-waitlist-survey.mjs --test a@b.com --plain
 *   node scripts/send-waitlist-survey.mjs --send -n 20 --plain
 *
 * Requires in .env: DATABASE_URL, RESEND_API_KEY, MAIL_FROM (verified domain).
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import pg from "pg";

// dotenv isn't a dependency of this project, so read .env directly. Only fills
// vars that aren't already set, matching dotenv's behaviour.
for (const line of fs
  .readFileSync(path.join(import.meta.dirname, "..", ".env"), "utf8")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/);
  if (!m) continue;
  const value = m[2].trim().replace(/^["'](.*)["']$/, "$1");
  if (process.env[m[1]] === undefined) process.env[m[1]] = value;
}

const SUBJECT = "You joined the Coterie waitlist, now I need your help";
const REPLY_TO = "aidan.chongjh@gmail.com";
const SURVEY_URL = "https://coterie.com.de/survey";
const UNSUBSCRIBE_URL = "https://coterie.com.de/waitlist";
const HTML_FILE = path.join(import.meta.dirname, "waitlist-survey-email.html");
const LOG_FILE = path.join(
  os.homedir(),
  "Library/CloudStorage/OneDrive-Soulways/Claude/waitlist-send-log.csv"
);

// Resend free tier: 100/day. Also paced at ~1.2s between sends to stay under
// their 2 requests/second rate limit with room to spare.
const DEFAULT_BATCH = 100;
const GAP_MS = 1200;

const args = process.argv.slice(2);
const live = args.includes("--send");
const nFlag = args.indexOf("-n");
const batchSize = nFlag !== -1 ? Number(args[nFlag + 1]) : DEFAULT_BATCH;
// --test <email> sends one real email to one address, byte-identical to what the
// waitlist would receive, and does NOT touch the send log or the database.
const testFlag = args.indexOf("--test");
const testTo = testFlag !== -1 ? args[testFlag + 1] : null;
// --plain sends the text-only variant instead of the HTML one.
const plain = args.includes("--plain");

const { DATABASE_URL, DATABASE_SSL, RESEND_API_KEY, MAIL_FROM } = process.env;

function die(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

if (!DATABASE_URL) die("DATABASE_URL missing from .env");
if (!RESEND_API_KEY) die("RESEND_API_KEY missing from .env");
if (!MAIL_FROM) {
  die(
    "MAIL_FROM missing from .env.\n" +
      "    Without it the code falls back to onboarding@resend.dev, which Resend only\n" +
      "    lets you send to your own address — every real recipient would 403.\n" +
      "    Verify coterie.com.de in Resend → Domains first, then set e.g.\n" +
      '    MAIL_FROM="Aidan from Coterie <aidan@coterie.com.de>"'
  );
}

// --- who has already been sent to -------------------------------------------

function readLog() {
  if (!fs.existsSync(LOG_FILE)) return new Set();
  return new Set(
    fs
      .readFileSync(LOG_FILE, "utf8")
      .split("\n")
      .slice(1) // header
      .map((line) => line.split(",")[0]?.trim().toLowerCase())
      .filter(Boolean)
  );
}

function appendLog(email, resendId) {
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, "email,sent_at,resend_id\n");
  }
  fs.appendFileSync(LOG_FILE, `${email},${new Date().toISOString()},${resendId}\n`);
}

// --- the email ---------------------------------------------------------------

const html = fs.readFileSync(HTML_FILE, "utf8");

const TEXT = `I'm Aidan, founder of Coterie, the app for volleyballers!

You're officially part of our volleyball gang now!

Coterie is one place to find and host pickup volleyball games in Singapore,
instead of a dozen group chats. A host posts a game, players claim a spot, and
when someone drops out the next person on the waitlist gets promoted
automatically. It's built, and it opens soon.

I'm building Coterie to make volleyball life easier. But first, I want to know
your problems as a volleyball player.

1. What's annoying?
2. What's missing?
3. What do you wish existed?

Help me out by filling in this quick survey. It takes 3 to 5 minutes, and your
answers decide what I build next.

Fill in the survey here: ${SURVEY_URL}

Thank you so much!

Aidan
Founder, Coterie

---
You are getting this because you joined the Coterie waitlist at coterie.com.de.
Coterie, Singapore. Unsubscribe: ${UNSUBSCRIBE_URL}
`;

// A plain-text-only version. Two reasons it exists:
//
// 1. Gmail rejected the HTML version with "similar to messages that were
//    identified as spam in the past" — a content-fingerprint match against the
//    near-identical copies sent while we were debugging. A short text-only mail
//    with different wording is a different fingerprint entirely.
// 2. Text-only mail from a young domain is filtered far less aggressively than
//    an image-and-button layout, because the layout is what bulk senders use.
//
// Deliberately reworded rather than just stripped, so it doesn't match the HTML
// version's fingerprint either.
const PLAIN_SUBJECT = "A question about volleyball in Singapore";
const PLAIN_TEXT = `Hi,

I'm Aidan. You put your email on the Coterie waitlist a while back, and I
haven't written since, so this is overdue.

Short version: the app is finished. Post a game, players claim spots, and the
waitlist refills a spot automatically when someone drops out. It opens soon.

Before it does I'd like to know what actually goes wrong for you when you try
to get a game together here. What's irritating, what's missing, what you wish
existed. There's a short form, about three minutes:

${SURVEY_URL}

If you'd rather just reply to this email with a sentence or two, that works
just as well and I read every one.

Thanks,
Aidan
Founder, Coterie

You're getting this because you joined the waitlist at coterie.com.de.
To stop hearing from me, reply with "unsubscribe" and I'll remove you.
`;

async function send(email, plain = false) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [email],
      reply_to: REPLY_TO,
      subject: plain ? PLAIN_SUBJECT : SUBJECT,
      ...(plain ? {} : { html }),
      text: plain ? PLAIN_TEXT : TEXT,
      // Gmail and Yahoo's bulk-sender rules weight these heavily, and their
      // absence is treated as a spam signal on its own. List-Unsubscribe-Post
      // is what puts Gmail's native "Unsubscribe" button next to the sender
      // name — which is the single clearest "this is legitimate bulk mail, not
      // a stranger" signal available to us.
      headers: {
        "List-Unsubscribe": `<${UNSUBSCRIBE_URL}>, <mailto:${REPLY_TO}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
  return body.id;
}

// --- test send --------------------------------------------------------------

if (testTo) {
  console.log(`\n  TEST SEND — one email, identical to the real thing.`);
  console.log(`  to        ${testTo}`);
  console.log(`  from      ${MAIL_FROM}`);
  console.log(`  reply-to  ${REPLY_TO}`);
  console.log(`  subject   ${plain ? PLAIN_SUBJECT : SUBJECT}`);
  console.log(`  variant   ${plain ? "PLAIN TEXT (no html, no image)" : "HTML"}`);
  console.log(`  (send log and database untouched)\n`);
  try {
    console.log(`  ✓ sent — resend id ${await send(testTo, plain)}\n`);
  } catch (err) {
    console.log(`  ✗ failed — ${err.message}\n`);
    process.exit(1);
  }
  process.exit(0);
}

// --- run --------------------------------------------------------------------

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

// Oldest signups first, so "the first 100" means the 100 who joined earliest and
// the ordering stays stable between runs even as new people sign up.
const { rows } = await pool.query(
  "SELECT email FROM waitlist ORDER BY created_at ASC, id ASC"
);
await pool.end();

const alreadySent = readLog();
const pending = rows
  .map((r) => r.email.trim())
  .filter((e) => e && !alreadySent.has(e.toLowerCase()));
const batch = pending.slice(0, batchSize);

console.log(`
  waitlist total      ${rows.length}
  already sent        ${alreadySent.size}
  remaining           ${pending.length}
  this batch          ${batch.length}
  from                ${MAIL_FROM}
  reply-to            ${REPLY_TO}
  log                 ${LOG_FILE}
  variant             ${plain ? "PLAIN TEXT (no html, no image)" : "HTML"}
  mode                ${live ? "LIVE — will send" : "DRY RUN — sends nothing"}
`);

if (!batch.length) {
  console.log("  Nothing left to send. Done.\n");
  process.exit(0);
}

if (!live) {
  console.log("  First 5 of this batch:");
  batch.slice(0, 5).forEach((e) => console.log(`    ${e}`));
  console.log(`\n  Re-run with --send to actually send these ${batch.length}.\n`);
  process.exit(0);
}

let ok = 0;
const failed = [];

for (const [i, email] of batch.entries()) {
  try {
    const id = await send(email, plain);
    appendLog(email, id); // logged immediately, before the next send
    ok++;
    console.log(`  ${String(i + 1).padStart(3)}/${batch.length}  ✓ ${email}`);
  } catch (err) {
    failed.push({ email, error: String(err.message).slice(0, 200) });
    console.log(`  ${String(i + 1).padStart(3)}/${batch.length}  ✗ ${email} — ${err.message}`);
    // Auth/domain errors will fail identically for everyone; stop rather than
    // hammer the API 100 times.
    if (String(err.message).startsWith("403") || String(err.message).startsWith("401")) {
      console.log("\n  Stopping — this looks like a sender/domain problem, not a bad address.");
      break;
    }
  }
  if (i < batch.length - 1) await new Promise((r) => setTimeout(r, GAP_MS));
}

console.log(`\n  Sent ${ok}. Failed ${failed.length}.`);
if (failed.length) {
  console.log("  Failures (not logged, so a re-run will retry them):");
  failed.forEach((f) => console.log(`    ${f.email} — ${f.error}`));
}
console.log(`  ${pending.length - ok} people still to go.\n`);
