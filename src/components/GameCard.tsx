import { Link } from "react-router-dom";
import type { Game } from "../types";
import { spotsLeft } from "../services/gamesService";
import { formatTimeRange, isPast } from "../lib/format";
import { gameRegions } from "../lib/courts";
import { CostBadge, SkillBadge, SpotsBadge, TypeBadge } from "./Badges";
import { ClockIcon, MapPinIcon } from "./icons";

function parseDateParts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    dow: date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(),
    day: d,
    mon: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
  };
}

export default function GameCard({
  game,
  youAreIn,
}: {
  game: Game;
  youAreIn?: boolean;
}) {
  const left = spotsLeft(game);
  const fillPct = Math.round(
    ((game.players.length + (game.preFilled ?? 0)) / game.totalSlots) * 100
  );
  const { dow, day, mon } = parseDateParts(game.date);
  // "You're in" reads oddly in present tense once the game already happened —
  // only show it for games that haven't started/ended yet.
  const showYouAreIn = youAreIn && !isPast(game.date);

  return (
    // `flex` rather than `block`, and the row lives on the link itself: in the
    // 2-column grid every card in a row is stretched to the tallest one, and a
    // block-level link left its inner row at natural height — so on the shorter
    // card the red date rail stopped ~20px above the bottom and left a white
    // strip inside the card. Making the link the flex container means both
    // columns stretch with it.
    <Link
      to={`/game/${game.id}`}
      className="flex overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-sm transition hover:border-slate-700 hover:shadow"
    >
      {/* Date sidebar */}
      <div className="flex w-[60px] shrink-0 flex-col items-center justify-center gap-0.5 bg-brand py-5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
          {dow}
        </span>
        <span className="text-[22px] font-semibold leading-none text-white">{day}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
          {mon}
        </span>
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        {/* Title + type */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold leading-tight text-white">
              {game.title}
            </h3>
            {showYouAreIn && (
              <span className="text-[11px] font-medium text-emerald-600">● You're in</span>
            )}
          </div>
          <TypeBadge type={game.type} />
        </div>

        {/* Time */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <ClockIcon className="size-3.5 shrink-0 text-slate-400" />
          {formatTimeRange(game.time, game.endTime)}
        </div>

        {/* Location */}
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
          <MapPinIcon className="size-3.5 shrink-0 text-slate-400" />
          <span className="truncate">{game.location}</span>
          {game.area && game.area !== game.location && (
            <span className="shrink-0 text-slate-400">· {game.area}</span>
          )}
          {/* Region, so a player scanning the list can tell at a glance whether
              a venue they don't recognise is anywhere near them. Boundary
              venues show both, matching the filters they turn up under. */}
          {gameRegions(game).length > 0 && (
            <span className="shrink-0 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
              {gameRegions(game).join("/")}
            </span>
          )}
        </div>

        {/* Fill bar + spots */}
        <div className="mt-0.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${
                left === 0
                  ? "bg-slate-400"
                  : left <= 2
                  ? "bg-rose-400"
                  : "bg-emerald-400"
              }`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <SpotsBadge left={left} total={game.totalSlots} />
        </div>

        {/* Host + cost + skill. This row consistently has slack (measured
            ~60-90px unused on real cards) unlike the title and fill-bar rows
            above, which is why the cost pill lives here rather than risk
            crowding either of those. */}
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] text-slate-400">hosted by {game.hostName}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            <CostBadge costPerPerson={game.costPerPerson} />
            <SkillBadge skill={game.skill} />
          </span>
        </div>
      </div>
    </Link>
  );
}
