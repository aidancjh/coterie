import { useState } from "react";
import { Link } from "react-router-dom";
import { PROGRAMS, priceLabel, type Program, type ProgramKind } from "../lib/programs";
import { formatDate } from "../lib/format";
import { CalendarIcon, MapPinIcon, TrophyIcon, UsersIcon } from "../components/icons";

/**
 * Programs — coached courses and club memberships, the third thing a player can
 * do here after browsing games and hosting one.
 *
 * The listings are prototype data (see `src/lib/programs.ts`); nothing books,
 * nothing charges. The banner below says so on the page rather than only in a
 * comment — a listing that looks live but isn't is a reliability failure, and
 * these have real-looking prices next to invented coaches.
 */

type Filter = "All" | ProgramKind;

const FILTERS: Filter[] = ["All", "Lesson", "Club"];

function ProgramCard({ p }: { p: Program }) {
  return (
    <Link
      to={`/programs/${p.id}`}
      className="block min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm transition active:scale-[0.99] hover:border-brand/30"
    >
      <div className="mb-2">
        <span
          className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
            p.kind === "Lesson"
              ? "bg-brand/10 text-brand"
              : "bg-sky-500/15 text-sky-700"
          }`}
        >
          {p.kind === "Lesson" ? "Coaching" : "Club"}
        </span>
      </div>

      <h2 className="text-base font-bold leading-snug text-white">{p.title}</h2>
      <p className="mt-0.5 text-sm text-slate-400">{p.summary}</p>

      <div className="mt-3 space-y-1.5 text-xs text-slate-400">
        <p className="flex min-w-0 items-center gap-1.5">
          <UsersIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{p.lead} · {p.level}</span>
        </p>
        <p className="flex min-w-0 items-center gap-1.5">
          <MapPinIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{p.venue}, {p.area}</span>
        </p>
        <p className="flex min-w-0 items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{p.schedule} · next {formatDate(p.dates[0])}</span>
        </p>
      </div>

      <p className="mt-3 border-t border-slate-800 pt-2.5 text-sm font-bold text-white">
        {priceLabel(p)}
      </p>
    </Link>
  );
}

export default function Programs() {
  const [filter, setFilter] = useState<Filter>("All");
  const shown = PROGRAMS.filter((p) => filter === "All" || p.kind === filter);

  return (
    <div>
      <div className="mb-3">
        <h1 className="text-2xl font-bold tracking-tight text-white">Programs</h1>
        <p className="text-sm text-slate-400">
          Coached courses and clubs to join, when a one-off game isn't what you want.
        </p>
      </div>

      {/* Said out loud, not hidden — these listings aren't live yet. */}
      <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-amber-800">
        Preview — these are sample listings while we sign up real coaches and clubs.
        Registering here doesn't book you a place yet.
      </p>

      {/* Kind switcher — same pill style as Browse's. */}
      <div className="mb-4 flex rounded-2xl bg-slate-800 p-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
              filter === f ? "bg-brand text-white shadow-sm" : "text-slate-300"
            }`}
          >
            {f === "All" ? "All" : f === "Lesson" ? "Coaching" : "Clubs"}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-700 bg-slate-800 py-16 text-center">
          <TrophyIcon className="mb-2 h-6 w-6 text-slate-400" aria-hidden />
          <p className="font-semibold text-slate-200">Nothing here yet</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((p) => (
            <ProgramCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
