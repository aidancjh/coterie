import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Game } from "../types";
import { useGames } from "../hooks/useGames";
import { useProfile } from "../hooks/useProfile";
import { isInGame, isOnWaitlist, getPendingReviews } from "../services/gamesService";
import { isPast } from "../lib/format";
import GameCard from "../components/GameCard";
import ReviewModal from "../components/ReviewModal";
import { GameCardSkeleton } from "../components/Skeleton";

/**
 * Every game you've already played or hosted, newest first. Lived as the
 * "Past" tab on Browse until 2026-08-23; Browse is now only games ahead of
 * you, and history is reached from the Profile page.
 */
export default function GameHistory() {
  const { games, loading, error, reload } = useGames();
  const me = useProfile();
  const navigate = useNavigate();

  // Which past games still have an open review window — powers the Review button.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [reviewGame, setReviewGame] = useState<Game | null>(null);
  useEffect(() => {
    getPendingReviews()
      .then((gs) => setPendingIds(new Set(gs.map((g) => g.id))))
      .catch(() => {});
  }, []);

  const past = useMemo(
    () =>
      games
        .filter(
          (g) => isInGame(g, me.id) || isOnWaitlist(g, me.id) || g.hostId === me.id
        )
        .filter((g) => isPast(g.date))
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    [games, me.id]
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate("/profile")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800"
          aria-label="Back to profile"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Game history</h1>
          <p className="text-sm text-slate-400">
            Games you've already played or hosted. Any host you still owe a review
            has a Review button on the card.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <GameCardSkeleton />
          <GameCardSkeleton />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800 py-12 text-center">
          <p className="text-sm text-rose-600">Couldn't load your games.</p>
          <button
            onClick={reload}
            className="mt-3 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </div>
      ) : past.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800 py-12 text-center">
          <p className="text-sm text-slate-400">
            No games played yet. Once you've played one, it shows up here with your
            teammates to rate.
          </p>
          <Link
            to="/"
            className="mt-3 inline-block rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Browse games
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {past.map((g) => {
            const canReview = g.hostId !== me.id && pendingIds.has(g.id);
            return (
              <div key={g.id} className="relative">
                <GameCard game={g} youAreIn={isInGame(g, me.id)} />
                {canReview && (
                  <button
                    onClick={() => setReviewGame(g)}
                    className="absolute right-3 top-3 z-10 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
                  >
                    Review
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {reviewGame && (
        <ReviewModal
          game={reviewGame}
          onDone={() => {
            setPendingIds((prev) => {
              const next = new Set(prev);
              next.delete(reviewGame.id);
              return next;
            });
            setReviewGame(null);
          }}
        />
      )}
    </div>
  );
}
