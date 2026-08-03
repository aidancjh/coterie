import { useCallback, useEffect, useState, type ReactNode } from "react";
import { adminApi } from "../services/adminService";

interface WaitlistSourceStat {
  source: string;
  count: number;
  percent: number | null; // null for the 'test' bucket (excluded from %)
}

interface WaitlistDayStat {
  date: string; // "YYYY-MM-DD"
  count: number;
}

interface WaitlistDaySourceStat {
  date: string; // "YYYY-MM-DD"
  counts: Record<string, number>; // source -> signups that day (zero-filled)
  total: number;
}

interface WaitlistDailyBySource {
  sources: string[]; // ordered by all-time volume, for legend order only
  days: WaitlistDaySourceStat[];
}

interface WaitlistFunnel {
  visits: number;
  started: number;
  submittedDb: number;
  submittedPosthog: number;
  startedRate: number;
  submittedRate: number;
  bySource: WaitlistSourceStat[];
  byCampaign: WaitlistSourceStat[];
  visitsByVideo: WaitlistSourceStat[];
  signupsByDay: WaitlistDayStat[];
  signupsByDaySource: WaitlistDailyBySource;
  posthogError: string | null;
}

// Friendly labels for the channels we tag with utm_source.
const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  reddit: "Reddit",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  googleform: "Google Form",
  direct: "Direct / untagged",
  other: "Other",
  test: "Test (excluded)",
};

// Colour per channel for the stacked daily chart. Keyed by SOURCE NAME, never
// by position, so a channel keeps its hue when a quiet week reorders the legend
// — otherwise "the orange one" would silently become a different platform.
//
// The eight chromatic hues are the validated categorical order (blue, orange,
// aqua, yellow, magenta, green, violet, red): worst adjacent CVD ΔE 9.1 and
// worst adjacent normal-vision ΔE 19.6 on a light surface, both above their
// gates. Three of them sit under 3:1 against white, which is why every segment
// carries a text label in the legend and an exact count on hover rather than
// relying on colour alone.
//
// 'direct' is deliberately grey: it is the residual "we couldn't attribute
// this" bucket, not a channel competing with the others, and grey is the one
// thing that reads as absence rather than identity.
const SOURCE_COLORS: Record<string, string> = {
  instagram: "#2a78d6",
  reddit: "#eb6834",
  tiktok: "#1baf7a",
  youtube: "#eda100",
  telegram: "#e87ba4",
  whatsapp: "#008300",
  googleform: "#4a3aa7",
  other: "#e34948",
  direct: "#94a3b8",
};
const UNKNOWN_SOURCE_COLOR = "#cbd5e1";
const colorForSource = (s: string) => SOURCE_COLORS[s] ?? UNKNOWN_SOURCE_COLOR;
const labelForSource = (s: string) => SOURCE_LABELS[s] ?? s;

// Horizontal room per day once every date is labelled. Dates are drawn rotated,
// so this only has to clear the *width* of a tick, not the text length.
const DAY_SLOT = 22;
// Floor so a chart with only a handful of days still fills a full-width card
// instead of huddling in the left third of it.
const BASE_CHART_W = 660;

// "Nice" integer axis ticks from 0 up to at least max (~`targetSteps` steps of
// 1/2/5×10ⁿ). Guarantees whole-number increments so count axes never show
// fractions. Pass a larger targetSteps for a denser, finer-grained axis.
function niceTicks(max: number, targetSteps = 4): number[] {
  const m = Math.max(1, max);
  const rawStep = m / targetSteps;
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = Math.max(1, Math.round([1, 2, 5, 10].map((x) => x * pow).find((s) => s >= rawStep) ?? 10 * pow));
  const ticks: number[] = [];
  for (let v = 0; v <= m; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < m) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

// One stage of a drop-off funnel: a label, its count/share of the top stage,
// and a bar sized to that share so the shrinkage is visible at a glance.
function FunnelStage({
  label,
  count,
  pct,
  barColor,
}: {
  label: string;
  count: number;
  pct: number;
  barColor: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">
          {count.toLocaleString()} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

// A titled box. Every section is one of these so the tab reads as a stack of
// cards rather than loose blocks running together.
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

// Every date down the x-axis, rotated so a month of them can't collide. Shared
// by both time-series charts so their axes are drawn identically.
function DateAxisLabels({
  dates,
  xOf,
  y,
}: {
  dates: string[];
  xOf: (i: number) => number;
  y: number;
}) {
  return (
    <>
      {dates.map((date, i) => (
        <text
          key={date}
          x={xOf(i)}
          y={y}
          fontSize="8.5"
          textAnchor="end"
          fill="#94a3b8"
          transform={`rotate(-60 ${xOf(i)} ${y})`}
        >
          {date.slice(5)}
        </text>
      ))}
    </>
  );
}

// A chart wide enough to label every day will outgrow its card. Scroll it
// inside its own box rather than letting it push the page sideways.
function ScrollableChart({ children }: { children: ReactNode }) {
  return <div className="-mx-1 overflow-x-auto px-1">{children}</div>;
}

// Dependency-free SVG line+area chart with a real y-axis: whole-number
// gridlines + labels up the side, and every date along the bottom.
function TimeSeriesLineChart({
  rows,
  emptyText,
  color,
  ariaLabel,
  tickSteps = 4,
}: {
  rows: WaitlistDayStat[];
  emptyText: string;
  color: string;
  ariaLabel: string;
  /** Number of y-axis gridline steps — pass a larger value for a denser axis. */
  tickSteps?: number;
}) {
  if (rows.length === 0) return <p className="text-xs text-slate-400">{emptyText}</p>;

  const plotLeft = 30;
  const w = Math.max(BASE_CHART_W, plotLeft + rows.length * DAY_SLOT + 12);
  const h = 300;
  const plotRight = w - 8;
  const plotTop = 12;
  // Rotated date labels need far more room under the plot than the old sparse
  // horizontal ones did.
  const plotBottom = h - 54;
  const ticks = niceTicks(Math.max(...rows.map((r) => r.count)), tickSteps);
  const axisMax = ticks[ticks.length - 1];
  const stepX = rows.length > 1 ? (plotRight - plotLeft) / (rows.length - 1) : 0;
  const xOf = (i: number) => (rows.length > 1 ? plotLeft + i * stepX : (plotLeft + plotRight) / 2);
  const yOf = (v: number) => plotTop + (plotBottom - plotTop) * (1 - v / axisMax);
  const linePoints = rows.map((r, i) => `${xOf(i)},${yOf(r.count)}`).join(" ");
  const areaPoints = `${xOf(0)},${plotBottom} ${linePoints} ${xOf(rows.length - 1)},${plotBottom}`;

  return (
    <ScrollableChart>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={plotLeft} y1={yOf(t)} x2={plotRight} y2={yOf(t)} stroke="#EEF2F6" strokeWidth="1" />
            <text x={plotLeft - 6} y={yOf(t) + 3} fontSize="9" textAnchor="end" fill="#94a3b8">{t}</text>
          </g>
        ))}
        <polygon points={areaPoints} fill={color} fillOpacity="0.12" />
        <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* One dot per day, with a native tooltip (hover/tap) showing the exact count. */}
        {rows.map((r, i) => (
          <circle key={r.date} cx={xOf(i)} cy={yOf(r.count)} r="2.5" fill={color}>
            <title>{`${r.date}: ${r.count}`}</title>
          </circle>
        ))}
        <DateAxisLabels dates={rows.map((r) => r.date)} xOf={xOf} y={plotBottom + 12} />
      </svg>
    </ScrollableChart>
  );
}

// Stacked daily bars: one bar per day, one segment per channel, so you can read
// both "how many signed up that day" and "where they came from" at once. Bars
// (not lines) because most days are small whole numbers and several channels
// sit at zero — overlapping lines at y=0 would be unreadable.
function StackedSourceTimeline({
  data,
  emptyText,
  ariaLabel,
}: {
  data: WaitlistDailyBySource;
  emptyText: string;
  ariaLabel: string;
}) {
  const { sources, days } = data;
  if (days.length === 0 || sources.length === 0)
    return <p className="text-xs text-slate-400">{emptyText}</p>;

  const plotLeft = 30;
  const w = Math.max(BASE_CHART_W, plotLeft + days.length * DAY_SLOT + 12);
  const h = 320;
  const plotRight = w - 8;
  const plotTop = 12;
  const plotBottom = h - 54;
  const ticks = niceTicks(Math.max(...days.map((d) => d.total)), 5);
  const axisMax = ticks[ticks.length - 1];
  const slot = (plotRight - plotLeft) / days.length;
  const barW = Math.max(3, Math.min(16, slot - 4));
  const centerOf = (i: number) => plotLeft + slot * (i + 0.5);
  const yOf = (v: number) => plotTop + (plotBottom - plotTop) * (1 - v / axisMax);

  return (
    <div className="space-y-2">
      {/* Legend — identity is never colour-alone. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {sources.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: colorForSource(s) }}
            />
            <span className="text-[11px] text-slate-600">{labelForSource(s)}</span>
          </li>
        ))}
      </ul>

      <ScrollableChart>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={plotLeft} y1={yOf(t)} x2={plotRight} y2={yOf(t)} stroke="#EEF2F6" strokeWidth="1" />
              <text x={plotLeft - 6} y={yOf(t) + 3} fontSize="9" textAnchor="end" fill="#94a3b8">{t}</text>
            </g>
          ))}

          {days.map((d, i) => {
            // Stack upward from the baseline in the legend's order, so the same
            // channel sits in the same band on every bar.
            let cursor = 0;
            return (
              <g key={d.date}>
                {sources.map((s) => {
                  const v = d.counts[s] || 0;
                  if (v === 0) return null;
                  const yTop = yOf(cursor + v);
                  const yBase = yOf(cursor);
                  cursor += v;
                  // 1px surface gap between segments so adjacent hues never
                  // bleed into one another.
                  const segH = Math.max(1, yBase - yTop - 1);
                  return (
                    <rect
                      key={s}
                      x={centerOf(i) - barW / 2}
                      y={yTop}
                      width={barW}
                      height={segH}
                      fill={colorForSource(s)}
                    >
                      <title>{`${d.date} · ${labelForSource(s)}: ${v}`}</title>
                    </rect>
                  );
                })}
                {/* Whole-bar hit area: gives zero days a tooltip too, and makes
                    the day total readable without hovering each segment. */}
                <rect
                  x={centerOf(i) - slot / 2}
                  y={plotTop}
                  width={slot}
                  height={plotBottom - plotTop}
                  fill="transparent"
                >
                  <title>
                    {`${d.date} — ${d.total} signup${d.total === 1 ? "" : "s"}` +
                      (d.total > 0
                        ? `\n${sources
                            .filter((s) => (d.counts[s] || 0) > 0)
                            .map((s) => `${labelForSource(s)}: ${d.counts[s]}`)
                            .join("\n")}`
                        : "")}
                  </title>
                </rect>
              </g>
            );
          })}

          <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke="#E2E8F0" strokeWidth="1" />
          <DateAxisLabels dates={days.map((d) => d.date)} xOf={centerOf} y={plotBottom + 12} />
        </svg>
      </ScrollableChart>
    </div>
  );
}

// Horizontal bar chart: y axis is the source (one row per channel), x axis is
// the count. A shared x-scale with gridlines + tick labels makes it read as a
// chart even when only one source has data.
function SourceBarChart({ rows, emptyText }: { rows: WaitlistSourceStat[]; emptyText: string }) {
  if (rows.length === 0) return <p className="text-xs text-slate-400">{emptyText}</p>;
  const ticks = niceTicks(Math.max(...rows.map((r) => r.count)));
  const axisMax = ticks[ticks.length - 1];
  return (
    <div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.source} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs text-slate-600">
              {SOURCE_LABELS[r.source] ?? r.source}
            </span>
            <div className="relative h-6 flex-1 overflow-hidden rounded bg-slate-100">
              {ticks.slice(1).map((t) => (
                <span
                  key={t}
                  className="absolute inset-y-0 w-px bg-slate-200"
                  style={{ left: `${(t / axisMax) * 100}%` }}
                />
              ))}
              <div
                className="absolute inset-y-0 left-0 rounded bg-blue-400"
                style={{ width: `${Math.max(1, (r.count / axisMax) * 100)}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-500">
              {r.count}
              {r.percent !== null && <span className="text-slate-400"> · {r.percent}%</span>}
            </span>
          </li>
        ))}
      </ul>
      {/* x-axis scale, aligned under the bar track (label col 7rem + gap, value col 6rem + gap) */}
      <div className="relative ml-[7.75rem] mr-[6.75rem] mt-1 h-4">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute -translate-x-1/2 text-[10px] tabular-nums text-slate-400"
            style={{ left: `${(t / axisMax) * 100}%` }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Funnel() {
  const [data, setData] = useState<WaitlistFunnel | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fresh = await adminApi.funnel();
      setData(fresh);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load funnel data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <div className="p-4">
        {error ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-600">{error}</p>
            <button
              onClick={load}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? "Retrying…" : "Try again"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
      </div>
    );
  }

  const conversionStats = [
    { label: "Visits (since launch)", value: data.visits.toLocaleString() },
    { label: "Signups (all time)", value: data.submittedDb.toLocaleString() },
    { label: "Conversion", value: `${data.submittedRate}%` },
  ];

  // Drop-off funnel: visits → started the waitlist form → actually submitted.
  // `started`/`startedRate` already come back from the API but were never
  // rendered — they're exactly what turns a single "27% conversion" number
  // into an actionable "most people who leave, leave before opening the form"
  // (vs. abandoning partway through it). Both depend on PostHog visit/start
  // data, so skip it when that's unavailable (posthogError / zero visits)
  // rather than show a misleading all-zero funnel.
  const showDropoff = !data.posthogError && data.visits > 0;
  const startedPct = data.startedRate;
  const submittedPctOfVisits = data.submittedRate;
  const submittedPctOfStarted =
    data.started > 0 ? Math.min(100, Math.round((data.submittedDb / data.started) * 100)) : null;
  const dropBeforeStarting = Math.max(0, 100 - startedPct);
  const dropAfterStarting = submittedPctOfStarted !== null ? Math.max(0, 100 - submittedPctOfStarted) : null;
  const biggestDrop =
    dropAfterStarting !== null && dropAfterStarting > dropBeforeStarting
      ? { pct: dropAfterStarting, where: "after starting the form but before finishing it" }
      : { pct: dropBeforeStarting, where: "before ever opening the form" };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Waitlist funnel</h2>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="text-xs text-slate-400">Updated {updatedAt.toLocaleTimeString()}</span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <span aria-hidden className={loading ? "animate-spin" : ""}>↻</span>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          Couldn't refresh ({error}) — showing the last loaded numbers.
        </p>
      )}
      {data.posthogError && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          PostHog data unavailable ({data.posthogError}) — every signup number here still comes
          from your own database and is accurate. The conversion rate's visit count, the drop-off
          funnel, and pageviews by video won't be right until this is fixed.
        </p>
      )}

      {/* 1. Signups over time — full width so every single date fits along the
          x-axis. All-time (not "since launch") because these are real people
          already on the list. */}
      <Card title="Signups over time (all time)">
        <TimeSeriesLineChart
          rows={data.signupsByDay}
          emptyText="No signups yet."
          color="#10B981"
          ariaLabel={`Signups per day, ${data.signupsByDay.length} days`}
        />
      </Card>

      {/* 2. The same daily signups, split by the channel they came from, on the
          same date axis as the total line above — so a spike can be read back
          to the channel that caused it. Sourced from our own waitlist table
          (exact, immune to ad blockers), not PostHog. */}
      <Card title="Signups per day by source (all time)">
        <StackedSourceTimeline
          data={data.signupsByDaySource}
          emptyText="No signups yet."
          ariaLabel={`Signups per day broken down by source, ${data.signupsByDaySource.days.length} days`}
        />
      </Card>

      {/* 3 & 4. Conversion rate in a box of its own, to the left of signups by
          source. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Conversion rate">
          <div className="flex flex-wrap gap-2">
            {conversionStats.map((s) => (
              <div key={s.label} className="rounded-lg bg-slate-50 px-3 py-1.5">
                <p className="text-[10px] text-slate-500">{s.label}</p>
                <p className="text-base font-semibold text-slate-900">{s.value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            PostHog also recorded {data.submittedPosthog} client-side submit events since launch
            (informational — the signup count above is the source of truth from our own database).
          </p>

          {/* Where visitors drop off — visits → started the form → actually
              submitted. Skipped when PostHog visit data isn't available since
              a start/visit-based funnel is meaningless without it. */}
          {showDropoff && (
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Where visitors drop off
              </p>
              <FunnelStage label="Visited" count={data.visits} pct={100} barColor="bg-blue-400" />
              <FunnelStage
                label="Started the form"
                count={data.started}
                pct={startedPct}
                barColor="bg-amber-400"
              />
              <FunnelStage
                label="Signed up"
                count={data.submittedDb}
                pct={submittedPctOfVisits}
                barColor="bg-emerald-400"
              />
              {biggestDrop.pct > 0 && (
                <p className="rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] leading-snug text-rose-700">
                  Biggest drop-off: <strong>{biggestDrop.pct}%</strong> leave {biggestDrop.where}.
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Signups by source — our own DB (exact, immune to ad blockers). */}
        <Card title="Signups by source (all time)">
          <SourceBarChart rows={data.bySource} emptyText="No signups yet." />
        </Card>
      </div>

      {/* 5. Signups by video — our own DB (utm_campaign, captured on submit
          same as source), exact and immune to ad blockers. */}
      <Card title="Signups by video (all time)">
        <SourceBarChart rows={data.byCampaign} emptyText="No signups yet." />
      </Card>

      {/* 6. Pageviews by video — PostHog, grouped by the `video` super property
          (registered from utm_campaign, src/lib/posthog.ts). The only source
          for video-level visit counts, since the waitlist page never hits our
          own API. Scoped to a later cutoff than the other launch metrics (see
          server/posthog.js SINCE_UTM_FIX): a capture bug meant pre-fix
          pageviews carry no reliable source tag at all. */}
      <Card title="Pageviews by video (since tracking fix)">
        <SourceBarChart rows={data.visitsByVideo} emptyText="No visits recorded yet." />
      </Card>
    </div>
  );
}
