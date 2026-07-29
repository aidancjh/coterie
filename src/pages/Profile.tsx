import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getUserHighlights } from "../services/gamesService";
import { api } from "../lib/api";
import { getUploadSignature } from "../lib/cloudinaryUpload";
import type { Highlight, SkillLevel } from "../types";
import { RatingHero, RatingEmpty } from "../components/Badges";
import ProfileHeader from "../components/ProfileHeader";
import {
  CameraIcon,
  ClapperIcon,
  HeartIcon,
  IconChip,
  LeafIcon,
  PencilIcon,
  TrophyIcon,
  UsersIcon,
  XIcon,
  ZapIcon,
} from "../components/icons";

// Selectable options. Values retired from these lists ("All Levels" as a
// personal skill, "Non-binary", "Defensive Specialist") are deliberately still
// accepted by the server and still rendered by the label maps below, so
// existing profiles that hold them keep displaying correctly — they just can't
// be newly chosen.
const skills: SkillLevel[] = ["Low Beginner", "High Beginner", "Low Intermediate", "High Intermediate", "Advanced"];
const GENDER_OPTIONS = ["Man", "Woman", "Prefer not to say"];
const POSITION_OPTIONS = ["Setter", "Outside Hitter", "Middle Blocker", "Opposite", "Libero"];


function computeAge(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const [y, m, d] = birthdate.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 ? age : null;
}

const SKILL_INFO: Record<SkillLevel, { Icon: React.ComponentType<{ className?: string }>; desc: string }> = {
  "All Levels":         { Icon: UsersIcon, desc: "Happy in any game at any pace. Just here to play!" },
  "Low Beginner":       { Icon: LeafIcon, desc: "Brand new to the game. Casual, friendly rallies — mistakes totally fine." },
  "High Beginner":      { Icon: LeafIcon, desc: "Basics are sticking. Can keep a rally going and learning rotations." },
  "Low Intermediate":   { Icon: ZapIcon, desc: "Comfortable with bumping, setting, serving. Know the rules and rotations." },
  "High Intermediate":  { Icon: TrophyIcon, desc: "Consistent, accurate play. Comfortable in competitive games." },
  Beginner:             { Icon: LeafIcon, desc: "New to the game. Casual, friendly rallies — mistakes totally fine." },
  Intermediate:         { Icon: ZapIcon, desc: "Comfortable with bumping, setting, serving. Know the rules and rotations." },
  Advanced:             { Icon: TrophyIcon, desc: "Consistent technique. Competitive experience, performs under pressure." },
};

// ---------------------------------------------------------------------------
// Highlights grid
// ---------------------------------------------------------------------------

function HighlightGrid({
  highlights,
}: {
  highlights: Highlight[];
}) {
  const [playing, setPlaying] = useState<Highlight | null>(null);

  if (highlights.length === 0) {
    return (
      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-white">My Highlights</p>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-800 py-8 text-center">
          <IconChip size="lg">
            <ClapperIcon className="h-6 w-6" />
          </IconChip>
          <p className="mt-1 text-sm text-slate-400">No highlights yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">
          My Highlights <span className="font-normal text-slate-400">({highlights.length})</span>
        </p>
      </div>

      <div className="grid grid-cols-4 gap-0.5 overflow-hidden rounded-2xl">
        {highlights.map((h) => (
          <button
            key={h.id}
            onClick={() => setPlaying(h)}
            className="relative aspect-square bg-black"
          >
            {h.thumbUrl || h.mediaType === "photo" ? (
              <img src={h.thumbUrl || h.videoUrl} alt={h.caption} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-lg text-white/60">▶</span>
              </div>
            )}
            {h.mediaType !== "photo" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition hover:opacity-100">
                <span className="text-base text-white drop-shadow">▶</span>
              </div>
            )}
            {h.likesCount > 0 && (
              <span className="absolute bottom-0.5 right-0.5 inline-flex items-center gap-0.5 rounded bg-black/50 px-0.5 text-[9px] text-white">
                <HeartIcon filled className="h-2 w-2" aria-hidden />
                {h.likesCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {playing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setPlaying(null)}
        >
          <div
            className="relative mx-4 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {playing.mediaType === "photo" ? (
              <img src={playing.videoUrl} alt={playing.caption} className="w-full rounded-2xl object-contain" />
            ) : (
              <video src={playing.videoUrl} controls autoPlay className="w-full rounded-2xl" />
            )}
            {playing.caption && (
              <p className="mt-2 text-center text-sm text-white/80">{playing.caption}</p>
            )}
            <button
              onClick={() => setPlaying(null)}
              className="absolute -top-10 right-0 inline-flex items-center gap-1 text-white/60 hover:text-white"
            >
              <XIcon className="h-3.5 w-3.5" aria-hidden />
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Profile() {
  const { user, updateProfile } = useAuth();

  const [editing, setEditing] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [stats, setStats] = useState<{ gamesHosted: number; gamesPlayed: number } | null>(null);

  // Edit-mode state
  const [name, setName] = useState(user?.name ?? "");
  const [skill, setSkill] = useState<SkillLevel>(user?.skill ?? "Intermediate");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [birthdate, setBirthdate] = useState(user?.birthdate ?? "");
  const [userGender, setUserGender] = useState(user?.userGender ?? "");
  const [showAge, setShowAge] = useState(user?.showAge !== false);
  const [showGender, setShowGender] = useState(user?.showGender !== false);
  const [favoritePositions, setFavoritePositions] = useState<string[]>(user?.favoritePositions ?? []);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showSkillInfo, setShowSkillInfo] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

  useEffect(() => {
    if (user?.id) {
      getUserHighlights(user.id).then(setHighlights).catch(() => {});
      api.get<{ gamesHosted: number; gamesPlayed: number }>(`/users/${user.id}/profile`)
        .then(setStats).catch(() => {});
    }
  }, [user?.id]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cloudName) return;
    setUploading(true);
    try {
      const { signature, timestamp, apiKey } = await getUploadSignature();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", apiKey);
      fd.append("timestamp", String(timestamp));
      fd.append("signature", signature);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: fd }
      );
      const data = await res.json();
      if (data.secure_url) setAvatarUrl(data.secure_url);
    } catch { /* silent */ } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setError("");
    try {
      await updateProfile({
        name: name.trim() || "You",
        skill,
        bio: bio.trim(),
        avatarUrl,
        birthdate: birthdate || null,
        userGender,
        showAge,
        showGender,
        favoritePositions,
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); setEditing(false); }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    }
  };

  const handleCancelEdit = () => {
    setName(user?.name ?? "");
    setSkill(user?.skill ?? "Intermediate");
    setBio(user?.bio ?? "");
    setAvatarUrl(user?.avatarUrl ?? "");
    setBirthdate(user?.birthdate ?? "");
    setUserGender(user?.userGender ?? "");
    setShowAge(user?.showAge !== false);
    setShowGender(user?.showGender !== false);
    setFavoritePositions(user?.favoritePositions ?? []);
    setError("");
    setEditing(false);
  };

  const initials = ((user?.name ?? "Y").trim() || "Y").charAt(0).toUpperCase();
  const displayAvatar = avatarUrl || user?.avatarUrl;

  // ── Edit mode ────────────────────────────────────────────────────────────

  if (editing) {
    return (
      <div>
        {/* Cancel sits hard left, the heading centres in what's left, so the two
            no longer read as one run-on phrase ("← Cancel Edit profile"). */}
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={handleCancelEdit}
            className="shrink-0 text-sm font-medium text-slate-400 transition hover:text-slate-200"
          >
            ← Cancel
          </button>
          <h1 className="flex-1 text-center text-lg font-bold text-white">Edit profile</h1>
          {/* Balances the Cancel button so the heading is optically centred. */}
          <span aria-hidden className="w-[4.25rem] shrink-0" />
        </div>

        {/* The photo is the point of this control, so nothing is overlaid on
            top of it — changing it is an explicit button underneath. */}
        <div className="mb-5 flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand text-3xl font-bold text-white">
            {displayAvatar ? (
              <img src={displayAvatar} alt={name} className="h-full w-full object-cover" />
            ) : initials}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-brand/40 hover:text-brand active:scale-95 disabled:opacity-50"
          >
            <CameraIcon className="h-3.5 w-3.5" aria-hidden />
            {uploading ? "Uploading…" : "Edit picture"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-200">Display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-200">Bio</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 300))}
              placeholder="Tell other players a bit about yourself…" rows={2}
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
            <p className="mt-0.5 text-right text-xs text-slate-400">{bio.length}/300</p>
          </label>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="text-sm font-medium text-slate-200">Skill level</span>
              <button onClick={() => setShowSkillInfo((v) => !v)}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-[11px] font-bold text-slate-400 hover:border-brand hover:text-brand transition">
                ?
              </button>
            </div>
            {showSkillInfo && (
              <div className="mb-3 space-y-2 rounded-xl border border-slate-800 bg-slate-800 p-3">
                {/* Explains the options you can actually pick — SKILL_INFO also
                    carries retired/legacy levels purely so old profiles render. */}
                {skills.map((s) => ({ s, ...SKILL_INFO[s] })).map(({ s, Icon, desc }) => (
                  <div key={s} className="flex gap-2 text-sm">
                    <IconChip size="sm">
                      <Icon className="h-4 w-4" />
                    </IconChip>
                    <div><span className="font-semibold text-slate-100">{s}:</span>{" "}<span className="text-slate-400">{desc}</span></div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <button key={s} onClick={() => setSkill(s)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${skill === s ? "bg-brand text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-200">Birthday</span>
            <input type="date" value={birthdate || ""} onChange={(e) => setBirthdate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-200">Gender</span>
            <div className="flex flex-wrap gap-1.5">
              {GENDER_OPTIONS.map((g) => (
                <button key={g} type="button" onClick={() => setUserGender(g === userGender ? "" : g)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${userGender === g ? "bg-brand text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-200">Favorite positions</span>
            <div className="flex flex-wrap gap-1.5">
              {POSITION_OPTIONS.map((p) => {
                const active = favoritePositions.includes(p);
                return (
                  <button key={p} type="button"
                    onClick={() => setFavoritePositions((prev) => active ? prev.filter((x) => x !== p) : [...prev, p])}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${active ? "bg-brand text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-800 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Privacy</p>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="text-sm text-slate-200">Show my age on profile</span>
              <button type="button" onClick={() => setShowAge((v) => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${showAge ? "bg-brand" : "bg-slate-700"}`}>
                <span className={`mt-0.5 ml-0.5 inline-block h-4 w-4 rounded-full bg-slate-900 shadow transition-transform ${showAge ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="text-sm text-slate-200">Show my gender on profile</span>
              <button type="button" onClick={() => setShowGender((v) => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${showGender ? "bg-brand" : "bg-slate-700"}`}>
                <span className={`mt-0.5 ml-0.5 inline-block h-4 w-4 rounded-full bg-slate-900 shadow transition-transform ${showGender ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </label>
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

          <button onClick={handleSave}
            className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-dark">
            {saved ? "Saved ✓" : "Save profile"}
          </button>
        </div>

      </div>
    );
  }

  // ── View mode ────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Shared with UserProfile so the two pages can't drift apart. The only
          difference is this action slot, which is a fixed size either way. */}
      <ProfileHeader
        name={user?.name || "You"}
        avatarUrl={displayAvatar}
        skill={user?.skill ?? "Intermediate"}
        positions={user?.favoritePositions}
        stats={{
          gamesPlayed: stats?.gamesPlayed ?? user?.gamesPlayed,
          gamesHosted: stats?.gamesHosted ?? user?.gamesHosted,
          participationRate: user?.participationRate,
          reviewCount: user?.hostRating?.count,
        }}
        action={
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black/30 active:scale-95"
          >
            <PencilIcon className="h-3.5 w-3.5" aria-hidden />
            Edit profile
          </button>
        }
      />

      <div className="mb-4 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 px-4 py-5 shadow-sm">
        {/* Age / gender, if the user chose to show them */}
        {(() => {
          const age = computeAge(user?.birthdate);
          const parts = [
            user?.showAge !== false && age !== null ? `${age} yrs` : null,
            user?.showGender !== false && user?.userGender ? user.userGender : null,
          ].filter(Boolean);
          return parts.length > 0 ? (
            <p className="text-center text-xs text-slate-400">{parts.join(" · ")}</p>
          ) : null;
        })()}

        {user?.bio && (
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{user.bio}</p>
        )}

        {/* Player rating, with participation beside the stars. It also appears
            in the header stat row; Aidan wants it in both places, so both are
            fed from the same value and can't disagree. */}
        <div className="mt-4">
          {user?.playerRating && user.playerRating.count > 0 ? (
            <RatingHero
              avg={user.playerRating.avg ?? 0}
              count={user.playerRating.count}
              participationRate={user?.participationRate}
            />
          ) : (
            <RatingEmpty participationRate={user?.participationRate} />
          )}
        </div>
      </div>

      {/* Highlights — the user's own clips, posted from here */}
      <HighlightGrid highlights={highlights} />

    </div>
  );
}
