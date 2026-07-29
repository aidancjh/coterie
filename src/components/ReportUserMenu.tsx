import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

const REASONS = [
  "Didn't turn up",
  "Rude or unfriendly",
  "Inappropriate messages",
  "Fake profile",
  "Something else",
];

/**
 * Overflow menu on another player's profile. Own-profile shows an Edit button
 * in the same slot, so the header keeps identical dimensions either way.
 */
export default function ReportUserMenu({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape — a menu you can't dismiss is a trap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const submit = async (reason: string) => {
    setBusy(true);
    setError("");
    try {
      await api.post("/reports", { targetType: "user", targetId: userId, reason });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`More options for ${userName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition hover:bg-black/20 active:scale-90"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="12" cy="19" r="1.75" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setSheet(true);
            }}
            className="w-full px-3 py-2.5 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
          >
            Report {userName.split(" ")[0]}
          </button>
        </div>
      )}

      {sheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => !busy && setSheet(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl bg-white p-5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <div className="text-center">
                <p className="text-base font-semibold text-slate-900">Report sent</p>
                <p className="mt-1.5 text-sm text-slate-500">
                  Thanks — our team will take a look. {userName} won't be told who reported them.
                </p>
                <button
                  onClick={() => {
                    setSheet(false);
                    setSent(false);
                  }}
                  className="mt-4 w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className="text-base font-semibold text-slate-900">Report {userName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  What went wrong? This is anonymous.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      disabled={busy}
                      onClick={() => submit(r)}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50"
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
                <button
                  disabled={busy}
                  onClick={() => setSheet(false)}
                  className="mt-3 w-full py-2 text-sm font-medium text-slate-500 disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
