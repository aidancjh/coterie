import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { UserProfile as Profile } from "../types";
import { getUserProfile, blockUser, unblockUser } from "../services/gamesService";
import { useProfile } from "../hooks/useProfile";
import { isInGame } from "../services/gamesService";
import GameCard from "../components/GameCard";
import { RatingHero, RatingEmpty } from "../components/Badges";
import ProfileHeader from "../components/ProfileHeader";
import ReportUserMenu from "../components/ReportUserMenu";
import { Spinner } from "../components/Skeleton";


function memberSince(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function UserProfile() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const me = useProfile();
  const [profile, setProfile] = useState<Profile | undefined | null>(undefined);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let active = true;
    getUserProfile(id)
      .then((p) => {
        if (!active) return;
        setProfile(p);
        setBlocked(!!p.blocked);
      })
      .catch(() => active && setProfile(null));
    return () => {
      active = false;
    };
  }, [id]);

  const toggleBlock = async () => {
    if (!profile) return;
    const next = !blocked;
    setBlocked(next);
    try {
      if (next) await blockUser(profile.id);
      else await unblockUser(profile.id);
    } catch {
      setBlocked(!next); // revert on failure
    }
  };

  if (profile === undefined) {
    return <Spinner />;
  }
  if (profile === null) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-slate-400">Player not found.</p>
        <button
          onClick={() => navigate("/")}
          className="mt-3 text-sm font-semibold text-white underline"
        >
          Back to browse
        </button>
      </div>
    );
  }

  const isMe = profile.id === me.id;
  const rating = profile.playerRating;

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-3 text-sm font-medium text-slate-400 hover:text-white"
      >
        ← Back
      </button>

      {/* Same component as your own profile — identical band, avatar, subtitle
          and stat row. Only the action slot differs, and it's a fixed size. */}
      <ProfileHeader
        name={profile.name}
        avatarUrl={profile.avatarUrl}
        skill={profile.skill}
        positions={profile.favoritePositions}
        nameSuffix={isMe ? <span className="ml-1 text-sm font-normal text-white/70">(you)</span> : undefined}
        stats={{
          gamesPlayed: profile.gamesPlayed,
          gamesHosted: profile.gamesHosted,
          participationRate: profile.participationRate,
          reviewCount: profile.hostRating?.count,
        }}
        action={
          isMe ? undefined : <ReportUserMenu userId={profile.id} userName={profile.name} />
        }
      />

      <div className="mb-4 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-sm">
        <div className="px-4 py-5">
          <div className="text-center">
            {(profile.ageDisplay || profile.genderDisplay) && (
              <p className="text-xs text-slate-400">
                {[profile.ageDisplay ? `${profile.ageDisplay} yrs` : null, profile.genderDisplay].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Member since {memberSince(profile.memberSince)}
            </p>
          </div>

          {profile.bio && (
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {profile.bio}
            </p>
          )}

          {/* Player rating, with participation beside the stars — same as your
              own profile, and the same value the header stat row shows. */}
          <div className="mt-4">
            {rating && rating.count > 0 ? (
              <RatingHero
                avg={rating.avg ?? 0}
                count={rating.count}
                participationRate={profile.participationRate}
              />
            ) : (
              <RatingEmpty participationRate={profile.participationRate} />
            )}
          </div>

        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-white">
        Upcoming games {isMe ? "you're" : `${profile.name} is`} hosting
      </h2>
      {profile.hostedUpcoming.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-800 py-8 text-center text-sm text-slate-400">
          No upcoming games hosted.
        </p>
      ) : (
        <div className="space-y-3">
          {profile.hostedUpcoming.map((g) => (
            <GameCard key={g.id} game={g} youAreIn={isInGame(g, me.id)} />
          ))}
        </div>
      )}

      {!isMe && (
        <div className="mt-6 border-t border-slate-800 pt-4 text-center">
          <button
            onClick={toggleBlock}
            className={`text-xs font-medium transition ${
              blocked
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-400 hover:text-rose-500"
            }`}
          >
            {blocked ? `Unblock ${profile.name}` : `Block ${profile.name}`}
          </button>
          {blocked && (
            <p className="mt-1 text-[11px] text-slate-400">
              You won't see their highlights or comments.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
