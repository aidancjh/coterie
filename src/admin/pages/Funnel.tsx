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
  signupsByDay: WaitlistDayStat[];
  signupsByDaySource: WaitlistDailyBySource;
  // Returned by /analytics/funnel but not rendered on this tab — "Pageviews by
  // video" was removed 2026-08-03 alongside "Pageviews over time" and
  // "Pageviews by source". Kept on the type because the endpoint really does
  // send it (see the matching comment in adminService.ts).
  visitsByVideo: WaitlistSourceStat[];
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

// Dependency-free SVG line+area chart with a real y-axis: whole-number
// gridlines + labels up the side, and every date along the bottom. The window
// feeding this is capped at WINDOW_DAYS by the caller (see HistorySlider),
// so a fixed internal coordinate space plus CSS-driven scaling (no explicit
// width/height attribute, just viewBox) is enough — it never has more dates
// to fit than that cap, however long the account's history gets.
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
  const w = 480;
  const h = 260;
  const plotRight = w - 8;
  const plotTop = 12;
  // Rotated date labels need far more room under the plot than the old sparse
  // horizontal ones did.
  const plotBottom = h - 46;
  const ticks = niceTicks(Math.max(...rows.map((r) => r.count)), tickSteps);
  const axisMax = ticks[ticks.length - 1];
  const stepX = rows.length > 1 ? (plotRight - plotLeft) / (rows.length - 1) : 0;
  const xOf = (i: number) => (rows.length > 1 ? plotLeft + i * stepX : (plotLeft + plotRight) / 2);
  const yOf = (v: number) => plotTop + (plotBottom - plotTop) * (1 - v / axisMax);
  const linePoints = rows.map((r, i) => `${xOf(i)},${yOf(r.count)}`).join(" ");
  const areaPoints = `${xOf(0)},${plotBottom} ${linePoints} ${xOf(rows.length - 1)},${plotBottom}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={ariaLabel}>
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
  );
}

// Stacked daily bars: one bar per day, one segment per channel, so you can read
// both "how many signed up that day" and "where they came from" at once. Bars
// (not lines) because most days are small whole numbers and several channels
// sit at zero — overlapping lines at y=0 would be unreadable. Same fixed
// viewBox reasoning as TimeSeriesLineChart — the caller caps this at
// WINDOW_DAYS, so it never needs to grow with total history.
function StackedSourceTimeline({
  data,
  emptyText,
  ariaLabel,
}: {
  data: WaitlistDailyBySource;
  emptyText: string;
  ariaLabel: string;
}) {
  const { sources: allSources, days } = data;
  if (days.length === 0 || allSources.length === 0)
    return <p className="text-xs text-slate-400">{emptyText}</p>;

  // The legend and the stack itself only need the channels that actually have
  // signups somewhere in THIS window — showing a swatch for a channel with
  // zero bars anywhere on screen just raises "why is that here?".
  const sources = allSources.filter((s) => days.some((d) => (d.counts[s] || 0) > 0));

  const plotLeft = 30;
  const w = 480;
  const h = 280;
  const plotRight = w - 8;
  const plotTop = 12;
  const plotBottom = h - 46;
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

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={ariaLabel}>
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

// Fixed size of the window the charts show — not just a default, an actual
// cap. A whole year of history would make an every-date axis and a legend
// unreadable no matter how it's laid out, so the charts never see more than
// this many days at once; HistorySlider is how you move which 14 days that is.
const WINDOW_DAYS = 14;

// "2026-08-03" -> "Aug 3". UTC-pinned so a day string never shifts by one
// depending on the browser's local timezone.
function formatShortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// "Jul 21 – Aug 3, 2026" — year shown once, at the end, unless the window
// straddles a year boundary (then both sides get one).
function formatRangeLabel(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const startFmt = start.toLocaleDateString("en-US", sameYear ? opts : { ...opts, year: "numeric" });
  const endFmt = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${startFmt} – ${endFmt}`;
}

// A history scrubber, not a toggle: the window is always WINDOW_DAYS wide, and
// this native range input moves WHICH window that is across the account's
// whole history. Unlike a "last 14 days / all time" switch, this scales to a
// year of data without ever asking a chart to render more than WINDOW_DAYS
// points — sliding left just walks the same fixed-size window backwards.
// The first/last date labels under the track are the two ends of the entire
// available range, so it's always clear how far back you can go.
function HistorySlider({
  start,
  maxStart,
  onChange,
  earliestDate,
  latestDate,
  windowStartDate,
  windowEndDate,
}: {
  start: number;
  maxStart: number;
  onChange: (start: number) => void;
  earliestDate: string;
  latestDate: string;
  windowStartDate: string;
  windowEndDate: string;
}) {
  const atLatest = start >= maxStart;
  return (
    <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700">
          {formatRangeLabel(windowStartDate, windowEndDate)}
        </span>
        {!atLatest && (
          <button
            onClick={() => onChange(maxStart)}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
          >
            Jump to latest →
          </button>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={maxStart}
        step={1}
        value={start}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`Move the ${WINDOW_DAYS}-day window across the full signup history`}
        className="w-full accent-emerald-500"
      />
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>{formatShortDate(earliestDate)}</span>
        <span>{formatShortDate(latestDate)}</span>
      </div>
    </div>
  );
}

export default function Funnel() {
  const [data, setData] = useState<WaitlistFunnel | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // Index into signupsByDay/signupsByDaySource.days marking the start of the
  // visible WINDOW_DAYS-wide window. Infinity means "stick to the most recent
  // window" — resolved against the real day count once data loads, so the
  // very first render (and every refresh) defaults to "latest" without a
  // useEffect. Once the slider is dragged it becomes a concrete index and
  // stays there across a refresh, same as any other scrubber.
  const [windowStart, setWindowStart] = useState(Infinity);

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

  // Windowing for the two scrubbable cards (signups over time, signups per
  // day by source). Signups by source stays all-time (data.bySource,
  // unwindowed) — Aidan wants the overall channel mix, not just whatever
  // window the slider happens to be on. The slider only appears once there's
  // more history than one window holds — otherwise there's nowhere to scrub.
  const totalDays = data.signupsByDay.length;
  const maxStartIndex = Math.max(0, totalDays - WINDOW_DAYS);
  const canScrub = totalDays > WINDOW_DAYS;
  const start = Math.min(windowStart, maxStartIndex);
  const windowedSignupsByDay = data.signupsByDay.slice(start, start + WINDOW_DAYS);
  const windowedSignupsByDaySource: WaitlistDailyBySource = {
    sources: data.signupsByDaySource.sources,
    days: data.signupsByDaySource.days.slice(start, start + WINDOW_DAYS),
  };
  // Only meaningful once there's at least one real day to anchor a range
  // label to — a brand-new waitlist with zero signups has none.
  const windowStartDate = windowedSignupsByDay[0]?.date;
  const windowEndDate = windowedSignupsByDay[windowedSignupsByDay.length - 1]?.date;

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
          from your own database and is accurate. Only the conversion rate's visit count and the
          drop-off funnel won't be right until this is fixed.
        </p>
      )}

      {/* Shared history scrubber for the three range-aware cards below — always
          a WINDOW_DAYS-wide window, defaulting to the most recent one. Hidden
          once there's no more history to scrub into. */}
      {/* canScrub (totalDays > WINDOW_DAYS) guarantees a full window exists,
          so windowStartDate/windowEndDate are real dates here. */}
      {canScrub && windowStartDate && windowEndDate && (
        <HistorySlider
          start={start}
          maxStart={maxStartIndex}
          onChange={setWindowStart}
          earliestDate={data.signupsByDay[0].date}
          latestDate={data.signupsByDay[data.signupsByDay.length - 1].date}
          windowStartDate={windowStartDate}
          windowEndDate={windowEndDate}
        />
      )}

      {/* 1 & 2. Signups over time and the same days split by channel, side by
          side — sharing the scrubber above them, on the same date axis, so a
          spike on the left can be read back to the channel on the right that
          caused it. The per-source chart is sourced from our own waitlist
          table (exact, immune to ad blockers), not PostHog. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Signups over time">
          <TimeSeriesLineChart
            rows={windowedSignupsByDay}
            emptyText="No signups yet."
            color="#10B981"
            ariaLabel={`Signups per day, ${windowedSignupsByDay.length} days`}
          />
        </Card>

        <Card title="Signups per day by source">
          <StackedSourceTimeline
            data={windowedSignupsByDaySource}
            emptyText="No signups yet."
            ariaLabel={`Signups per day broken down by source, ${windowedSignupsByDaySource.days.length} days`}
          />
        </Card>
      </div>

      {/* 3 & 4. Conversion rate in a box of its own, to the left of signups by
          source. Neither is scrubber-controlled — both are all-time
          summaries, same as Signups by video further down. */}
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

        {/* Signups by source — our own DB (exact, immune to ad blockers).
            All time, NOT scrubber-controlled — the overall channel mix, same
            as Conversion rate beside it, rather than whatever window the
            slider above happens to be on. */}
        <Card title="Signups by source (all time)">
          <SourceBarChart rows={data.bySource} emptyText="No signups yet." />
        </Card>
      </div>

      {/* 5. Signups by video — our own DB (utm_campaign, captured on submit
          same as source), exact and immune to ad blockers. Not range-controlled
          (all time) — the scrubber above only governs the two cards it sits
          beside. */}
      <Card title="Signups by video (all time)">
        <SourceBarChart rows={data.byCampaign} emptyText="No signups yet." />
      </Card>
    </div>
  );
}
