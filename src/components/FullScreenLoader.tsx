/**
 * Full-screen branded loader: a detailed volleyball bouncing over a pulsing
 * ground shadow (no squash — the ball stays a perfect circle). Shown while auth resolves so the app never flashes a
 * blank screen. The animation classes live in index.css (ball-bounce / -spin /
 * -shadow) and respect prefers-reduced-motion.
 */

function VolleyballBall() {
  return (
    <img
      src="/logo-mark.png"
      alt="Coterie"
      draggable={false}
      style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
    />
  );
}

export default function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-7 bg-white">
      <div className="relative" style={{ width: 84, height: 140 }}>
        {/* shadow is painted first so the ball sits on top of it at rest */}
        <div
          className="ball-shadow absolute"
          style={{ left: 14, bottom: 4, width: 56, height: 11, borderRadius: "50%", background: "#000" }}
        />
        <div
          className="ball-bounce absolute"
          style={{ left: 10, bottom: 10, width: 64, height: 64 }}
        >
          <div className="ball-spin" style={{ width: "100%", height: "100%" }}>
            <VolleyballBall />
          </div>
        </div>
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Coterie</p>
    </div>
  );
}
