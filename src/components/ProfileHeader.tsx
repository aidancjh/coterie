import type { ReactNode } from "react";
import { SkillBadge } from "./Badges";

/**
 * The profile header, shared by your own profile and everyone else's.
 *
 * It exists as one component precisely so the two can't drift: the brand band,
 * avatar size, name, subtitle and stat row are defined once, and the only
 * difference between the two pages is what gets passed into `action` (an Edit
 * button for yourself, a report menu for someone else). Both slots are the
 * same fixed size, so swapping one for the other never shifts the layout.
 */

export interface ProfileHeaderStats {
  gamesPlayed?: number;
  gamesHosted?: number;
  participationRate?: number | null;
  reviewCount?: number;
}

/** "Beginner · Setter, Libero" — the standard and positions, in one line. */
export function positionSummary(positions?: string[]): string {
  if (!positions || positions.length === 0) return "Any position";
  // "Any" is stored as the value but reads as ambiguous on its own.
  if (positions.includes("Any")) return "Any position";
  return positions.join(", ");
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 flex-1 px-1 text-center">
      <p className="truncate text-lg font-bold leading-tight text-white tabular-nums">{value}</p>
      <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-white/70">
        {label}
      </p>
    </div>
  );
}

export default function ProfileHeader({
  name,
  avatarUrl,
  skill,
  positions,
  stats,
  action,
  nameSuffix,
}: {
  name: string;
  avatarUrl?: string;
  skill: string;
  positions?: string[];
  stats: ProfileHeaderStats;
  /** Top-right control: Edit profile (own) or the report menu (others). */
  action?: ReactNode;
  /** e.g. "(you)" when viewing your own profile via /user/:id. */
  nameSuffix?: ReactNode;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="mb-4 overflow-hidden rounded-3xl bg-brand shadow-sm">
      {/* Top bar — fixed height so the header is the same whether or not
          there's an action, and whichever action it is. */}
      <div className="flex h-11 items-center justify-end px-3">{action}</div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-2xl font-bold text-brand ring-4 ring-white/25">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold text-white">
              {name}
              {nameSuffix}
            </p>
            {/* Standard and position, replacing the old free-text tagline. */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <SkillBadge skill={skill as never} />
              <span className="text-xs text-white/80">·</span>
              <span className="truncate text-xs font-medium text-white/90">
                {positionSummary(positions)}
              </span>
            </div>
          </div>
        </div>

        {/* Four stats on one line. Kept inside the coloured band so the header
            reads as a single unit rather than a card with a hat on. */}
        <div className="mt-4 flex items-stretch rounded-2xl bg-black/15 py-2.5">
          <Stat value={String(stats.gamesPlayed ?? 0)} label="Joined" />
          <span className="w-px shrink-0 bg-white/20" aria-hidden />
          <Stat value={String(stats.gamesHosted ?? 0)} label="Hosted" />
          <span className="w-px shrink-0 bg-white/20" aria-hidden />
          <Stat
            value={stats.participationRate == null ? "—" : `${stats.participationRate}%`}
            label="Participation"
          />
          <span className="w-px shrink-0 bg-white/20" aria-hidden />
          <Stat value={String(stats.reviewCount ?? 0)} label="Reviews" />
        </div>
      </div>
    </div>
  );
}
