import { useNavigate } from "react-router-dom";
import { Logo } from "./Logo";

/**
 * Shown for any route that doesn't match (the catch-all in App.tsx). Renders
 * inside Layout, so the header + bottom nav stay put and the user is never
 * stranded — previously a bad URL silently rendered the Browse page, which read
 * as a glitch.
 */
export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <Logo className="h-12 w-12" />
      <div>
        <h1 className="text-xl font-bold text-white">Page not found</h1>
        <p className="mt-1 max-w-xs text-sm text-slate-400">
          That page doesn't exist or may have moved. Let's get you back to the games.
        </p>
      </div>
      <button
        onClick={() => navigate("/")}
        className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-95"
      >
        Back to browse
      </button>
    </div>
  );
}
