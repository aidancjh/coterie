// Every /api/admin/* route. Mounted by BOTH nowhere else — only
// server/admin-server.js mounts this, behind requireAdminAuth. The consumer
// app (server/index.js) no longer serves any /api/admin/* route at all.
import { Router } from "express";
import { h } from "./lib/asyncHandler.js";
import { requireAdminAuth } from "./adminAuth.js";
import {
  queryWaitlistFunnel,
  queryWaitlistVisitsBySource,
  queryWaitlistVisitsByVideo,
  queryWaitlistVisitsByDay,
} from "./posthog.js";
import * as repo from "./repo.js";

const router = Router();
router.use(requireAdminAuth);

router.get(
  "/whoami",
  h(async (req, res) => {
    const user = await repo.findUserById(req.userId);
    res.json(repo.publicUser(user));
  })
);

router.get("/stats", h(async (_req, res) => res.json(await repo.adminStats())));

router.get("/users", h(async (_req, res) => res.json(await repo.adminListUsers())));

router.patch(
  "/users/:id/role",
  h(async (req, res) => {
    const user = await repo.setUserRole(req.params.id, req.body && req.body.role);
    if (!user) return res.status(400).json({ error: "Invalid role." });
    await repo.logAdminAction(req.userId, "set_role", `Set ${user.name}'s role to ${user.role}`);
    res.json(repo.publicUser(user));
  })
);

router.get("/games", h(async (_req, res) => res.json(await repo.adminListGames())));

router.delete(
  "/games/:id",
  h(async (req, res) => {
    const title = await repo.adminDeleteGame(req.params.id);
    await repo.logAdminAction(req.userId, "delete_game", `Deleted game "${title}"`);
    res.status(204).end();
  })
);

router.patch(
  "/users/:id/suspend",
  h(async (req, res) => {
    const target = await repo.findUserById(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found." });
    if ((target.role || "user") === "admin")
      return res.status(400).json({ error: "Admin accounts can't be suspended." });
    const user = await repo.setUserSuspended(req.params.id, req.body && req.body.suspended === true);
    await repo.logAdminAction(
      req.userId,
      "suspend_user",
      `${user.suspended ? "Suspended" : "Unsuspended"} ${user.name} (${user.email})`
    );
    res.json(repo.publicUser(user));
  })
);

router.delete(
  "/users/:id",
  h(async (req, res) => {
    const target = await repo.findUserById(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found." });
    if ((target.role || "user") === "admin")
      return res.status(400).json({ error: "Admin accounts can't be deleted here." });
    await repo.adminDeleteUser(req.params.id);
    await repo.logAdminAction(req.userId, "delete_user", `Removed ${target.name} (${target.email})`);
    res.status(204).end();
  })
);

router.get("/highlights", h(async (_req, res) => res.json(await repo.adminListHighlights())));

router.delete(
  "/highlights/:id",
  h(async (req, res) => {
    const owner = await repo.adminDeleteHighlight(req.params.id);
    await repo.logAdminAction(req.userId, "delete_highlight", `Deleted highlight by ${owner}`);
    res.status(204).end();
  })
);

router.get("/comments", h(async (_req, res) => res.json(await repo.adminListComments())));

router.delete(
  "/comments/:kind/:id",
  h(async (req, res) => {
    const kind = req.params.kind === "highlight" ? "highlight" : "game";
    await repo.adminDeleteComment(kind, req.params.id);
    await repo.logAdminAction(req.userId, "delete_comment", `Deleted a ${kind} comment`);
    res.status(204).end();
  })
);

router.post(
  "/seed-past-data",
  h(async (req, res) => {
    const { seedPastData, seedEngagement } = await import("./seed.js");
    await seedPastData();
    await seedEngagement();
    await repo.logAdminAction(req.userId, "seed_past_data", "Ran: seed past data");
    res.json({ ok: true });
  })
);

router.get("/feedback", h(async (_req, res) => res.json(await repo.adminListFeedback())));

router.patch(
  "/feedback/:id/resolve",
  h(async (req, res) => {
    const resolved = !!(req.body && req.body.resolved);
    await repo.setFeedbackResolved(req.params.id, resolved);
    await repo.logAdminAction(
      req.userId,
      "feedback_resolve",
      `Marked feedback ${resolved ? "resolved" : "open"}`
    );
    res.json({ ok: true, resolved });
  })
);

router.delete(
  "/feedback/:id",
  h(async (req, res) => {
    await repo.adminDeleteFeedback(req.params.id);
    await repo.logAdminAction(req.userId, "feedback_delete", "Deleted a feedback item");
    res.status(204).end();
  })
);

router.get("/audit", h(async (_req, res) => res.json(await repo.adminListAudit())));

router.get("/reports", h(async (_req, res) => res.json(await repo.adminListReports())));

router.patch(
  "/reports/:id",
  h(async (req, res) => {
    const status = req.body && req.body.status;
    if (!(await repo.adminSetReportStatus(req.params.id, status)))
      return res.status(400).json({ error: "Invalid status." });
    await repo.logAdminAction(req.userId, "report_status", `Marked a report ${status}`);
    res.json({ ok: true, status });
  })
);

router.post(
  "/broadcast",
  h(async (req, res) => {
    const message = (req.body && req.body.message ? String(req.body.message) : "").trim();
    if (!message) return res.status(400).json({ error: "Message is required." });
    if (message.length > 280)
      return res.status(400).json({ error: "Keep announcements under 280 characters." });
    const count = await repo.broadcastAnnouncement(message);
    await repo.logAdminAction(req.userId, "broadcast", `Sent announcement to ${count} users: "${message.slice(0, 80)}"`);
    res.json({ ok: true, count });
  })
);

router.get("/flags", h(async (_req, res) => res.json(await repo.getFlags())));

router.patch(
  "/flags/:key",
  h(async (req, res) => {
    const key = req.params.key;
    if (!["maintenance_mode", "signups_enabled"].includes(key))
      return res.status(400).json({ error: "Unknown flag." });
    const enabled = !!(req.body && req.body.enabled);
    await repo.setFlag(key, enabled);
    await repo.logAdminAction(req.userId, "set_flag", `Set ${key} to ${enabled ? "ON" : "OFF"}`);
    res.json({ ok: true, key, enabled });
  })
);

// Today as a UTC "YYYY-MM-DD" string (matches the UTC day-bucketing in the
// signup + pageview day queries).
function todayUTCString() {
  return new Date().toISOString().slice(0, 10);
}

// Inclusive list of "YYYY-MM-DD" from start to end (UTC). Capped at ~13 months
// so a malformed/ancient start date can never spin into a runaway loop.
function eachDayInclusive(start, end) {
  const last = new Date(`${end}T00:00:00Z`);
  let d = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(last.getTime())) return [end];
  const floor = new Date(last);
  floor.setUTCDate(floor.getUTCDate() - 400);
  if (d < floor) d = floor;
  const out = [];
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// Zero-fill two raw daily series onto ONE shared axis: from the earliest day
// present in either series (all time) through today. Keeps the pageviews and
// signups charts perfectly aligned on the x-axis.
function alignDailySeries(rawSignups, rawVisits) {
  const today = todayUTCString();
  const days = [...rawSignups, ...rawVisits].map((r) => r.date).filter(Boolean).sort();
  const dates = eachDayInclusive(days.length ? days[0] : today, today);
  const signupMap = new Map(rawSignups.map((r) => [r.date, r.count]));
  const visitMap = new Map(rawVisits.map((r) => [r.date, r.count]));
  return {
    dates,
    signupsByDay: dates.map((date) => ({ date, count: signupMap.get(date) || 0 })),
    visitsByDay: dates.map((date) => ({ date, count: visitMap.get(date) || 0 })),
  };
}

// Reshape raw [{ date, source, count }] rows into a stacked-chart-ready series,
// zero-filled onto the SAME `dates` axis the total signups line uses, so the
// stack for a day always adds up to the point plotted above it.
//
// `sources` is ordered by all-time volume (biggest channel first) purely so the
// legend reads best-to-worst. It deliberately does NOT drive colour: the chart
// keys colour off the source name, so a channel keeps its hue even when a
// quieter week reorders this list.
function buildDailyBySource(dates, rawRows) {
  const totals = new Map();
  for (const r of rawRows) totals.set(r.source, (totals.get(r.source) || 0) + r.count);
  const sources = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([source]) => source);

  const byDate = new Map();
  for (const r of rawRows) {
    if (!byDate.has(r.date)) byDate.set(r.date, {});
    byDate.get(r.date)[r.source] = r.count;
  }

  const days = dates.map((date) => {
    const raw = byDate.get(date) || {};
    const counts = {};
    let total = 0;
    for (const s of sources) {
      counts[s] = raw[s] || 0;
      total += counts[s];
    }
    return { date, counts, total };
  });

  return { sources, days };
}

// Attach a "% of real signups/visits" to each {source, count} row. The private
// 'test' bucket (our own testing) is excluded from the denominator and gets a
// null percent so self-testing never skews the numbers.
function withRealShare(rows) {
  const realTotal = rows
    .filter((r) => r.source !== "test")
    .reduce((sum, r) => sum + r.count, 0);
  return rows.map((r) => ({
    source: r.source,
    count: r.count,
    percent:
      r.source === "test" || realTotal === 0
        ? null
        : Math.round((r.count / realTotal) * 1000) / 10, // one decimal place
  }));
}

// --- Waitlist funnel analytics --------------------------------------------
// submittedDb + bySource + byCampaign + signupsByDay (from our own waitlist
// table) are the source of truth and a hard dependency — a real DB failure
// here is a genuine 500. PostHog (visits, started, submittedPosthog,
// visitsBySource, visitsByVideo) is best-effort: a misconfigured/unreachable
// PostHog project (bad key, wrong project id, PostHog outage) must not take
// down the whole tab when the DB-backed numbers are still available —
// degrade to zeros/empty + posthogError instead.
router.get(
  "/analytics/funnel",
  h(async (_req, res) => {
    const [submittedDb, rawBySource, rawByCampaign, rawSignupsByDay, rawSignupsByDaySource] =
      await Promise.all([
        repo.getWaitlistCount(),
        repo.getWaitlistCountsBySource(),
        repo.getWaitlistCountsByCampaign(),
        repo.getWaitlistSignupsByDay(),
        repo.getWaitlistSignupsByDaySource(),
      ]);

    let visits = 0;
    let started = 0;
    let submittedPosthog = 0;
    let rawVisitsBySource = [];
    let rawVisitsByVideo = [];
    let rawVisitsByDay = [];
    let posthogError = null;
    try {
      const [funnel, visitsBySource, visitsByVideo, visitsByDayResult] = await Promise.all([
        queryWaitlistFunnel(),
        queryWaitlistVisitsBySource(),
        queryWaitlistVisitsByVideo(),
        queryWaitlistVisitsByDay(),
      ]);
      ({ visits, started, submittedPosthog } = funnel);
      rawVisitsBySource = visitsBySource;
      rawVisitsByVideo = visitsByVideo;
      rawVisitsByDay = visitsByDayResult;
    } catch (err) {
      console.error("[funnel] PostHog query failed:", err);
      posthogError = err instanceof Error ? err.message : "PostHog is unavailable.";
    }

    const startedRate = visits > 0 ? Math.round((started / visits) * 100) : 0;
    const submittedRate = visits > 0 ? Math.round((submittedDb / visits) * 100) : 0;
    const bySource = withRealShare(rawBySource);
    const byCampaign = withRealShare(
      rawByCampaign.map((r) => ({ source: r.campaign || "untagged", count: r.count }))
    );
    const visitsBySource = withRealShare(
      rawVisitsBySource.map((r) => ({ source: r.source, count: r.visits }))
    );
    const visitsByVideo = withRealShare(
      rawVisitsByVideo.map((r) => ({ source: r.video, count: r.visits }))
    );
    // Every time series shares one axis: earliest data day → today.
    const { dates, signupsByDay, visitsByDay } = alignDailySeries(rawSignupsByDay, rawVisitsByDay);
    const signupsByDaySource = buildDailyBySource(dates, rawSignupsByDaySource);
    res.json({
      visits,
      started,
      submittedDb,
      submittedPosthog,
      startedRate,
      submittedRate,
      bySource,
      byCampaign,
      visitsBySource,
      visitsByVideo,
      signupsByDay,
      signupsByDaySource,
      visitsByDay,
      posthogError,
    });
  })
);

export default router;
