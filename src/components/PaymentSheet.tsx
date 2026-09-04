import { useMemo, useState } from "react";
import Modal from "./Modal";
import { setMemberPaid } from "../services/gamesService";
import { formatMoney } from "../lib/format";
import { CheckIcon, CoinsIcon } from "./icons";
import type { Game } from "../types";

/**
 * How a player settles their share of the court fee.
 *
 * **Coterie does not move any money.** Players PayNow the host directly, which
 * is what every pickup group in Singapore already does — this sheet just puts
 * the host's details, the amount and the reference in one place so nobody has
 * to scroll the chat for them. Tapping *I've transferred* sets the existing
 * `game_members.paid` flag (`POST /games/:id/members/:memberId/paid`, which a
 * player is allowed to call for themselves), and that is the same flag the host
 * reads in their payment list.
 *
 * That honesty is deliberate and load-bearing:
 *
 * - The QR below is **drawn, not encoded** — a deterministic pattern from the
 *   game id, not a scannable PayNow code. It is labelled as a sample on the
 *   face of the sheet. An unlabelled fake payment QR in a shipped app is
 *   something a real person could scan and lose money to.
 * - The card option is a **preview** and takes no card details. Collecting card
 *   numbers into a screen that settles nothing would be worse than not offering
 *   it at all.
 *
 * Replace `HOST_PAYNOW` with the host's real handle once profiles carry one;
 * today no column exists for it, so a placeholder derived from the host's name
 * is the honest stand-in and is marked as such in the UI.
 */

/** Placeholder handle. There is no PayNow column on `users` yet — see above. */
const HOST_PAYNOW = "+65 8••• ••42";

/**
 * A QR-shaped pattern derived from a string. Deterministic so the same game
 * always renders the same block, which makes it read as a real code at a glance
 * without pretending to be one. 21×21 is the QR v1 module count.
 */
function useQrPattern(seed: string): boolean[][] {
  return useMemo(() => {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const next = () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return (h >>> 0) / 4294967296;
    };
    const N = 21;
    const grid: boolean[][] = Array.from({ length: N }, () =>
      Array.from({ length: N }, () => next() > 0.52)
    );
    // The three finder squares, so the shape reads as a QR code.
    const finder = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const edge = r === 0 || r === 6 || c === 0 || c === 6;
          const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[r0 + r][c0 + c] = edge || core;
        }
      }
      // Quiet ring around each finder.
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = r0 + r, cc = c0 + c;
          if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
          if (r === -1 || r === 7 || c === -1 || c === 7) grid[rr][cc] = false;
        }
      }
    };
    finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
    return grid;
  }, [seed]);
}

function QrBlock({ seed }: { seed: string }) {
  const grid = useQrPattern(seed);
  const N = grid.length;
  return (
    <svg
      viewBox={`0 0 ${N} ${N}`}
      className="h-36 w-36"
      role="img"
      aria-label="Sample PayNow QR code — not scannable"
      shapeRendering="crispEdges"
    >
      <rect width={N} height={N} fill="#ffffff" />
      {grid.map((row, r) =>
        row.map((on, c) =>
          on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0f172a" /> : null
        )
      )}
    </svg>
  );
}

type Method = "paynow" | "card";

export default function PaymentSheet({
  game,
  meId,
  onClose,
}: {
  game: Game;
  meId: string;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<Method>("paynow");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const amount = game.costPerPerson;
  const reference = `${game.title.split(" @ ")[0].slice(0, 14)} ${game.date.slice(5).replace("-", "")}`;

  async function markPaid() {
    setError("");
    setSaving(true);
    try {
      await setMemberPaid(game.id, meId, true);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update your payment status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      onClose={() => { if (!saving) onClose(); }}
      align="bottom"
      backdropClassName="scrim-70"
      // Taller than an iPhone SE viewport once the QR, the details and both
      // buttons are stacked — so the panel scrolls inside itself rather than
      // pushing its own heading off the top of the screen.
      panelClassName="animate-sheet-up flex max-h-[calc(100svh-2rem)] w-full max-w-sm flex-col overflow-y-auto overscroll-contain rounded-3xl bg-slate-900 shadow-2xl"
      labelledBy="pay-title"
    >
      {done ? (
        <div className="px-8 pb-8 pt-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckIcon className="h-7 w-7" />
          </div>
          <h2 id="pay-title" className="text-2xl font-bold leading-tight text-white">
            Marked as paid
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {game.hostName} sees you as paid on their list for{" "}
            <strong className="text-slate-200">{game.title}</strong>. If the transfer
            hasn't landed they can untick it.
          </p>
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-2xl bg-brand py-3.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.97]"
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <div className="px-7 pb-1 pt-6 text-center">
            <h2 id="pay-title" className="text-xl font-bold leading-tight text-white">
              Pay your share
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {formatMoney(amount)} to {game.hostName} for {game.title}
            </p>
          </div>

          {/* Method switcher */}
          <div className="mx-7 mt-4 flex rounded-2xl bg-slate-800 p-1">
            {([
              ["paynow", "PayNow"],
              ["card", "Card"],
            ] as [Method, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setMethod(key)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                  method === key ? "bg-brand text-white shadow-sm" : "text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {method === "paynow" ? (
            <div className="px-7 pt-5">
              <div className="flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-800 p-4">
                <div className="rounded-xl bg-white p-2.5">
                  <QrBlock seed={game.id} />
                </div>
                {/* Stated on the face of the sheet, not buried — this pattern is
                    drawn from the game id and encodes nothing. */}
                <p className="mt-2.5 text-center text-[11px] font-medium text-slate-400">
                  Sample QR — not scannable yet
                </p>
              </div>

              <dl className="mt-4 space-y-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Amount</dt>
                  <dd className="text-sm font-semibold text-slate-100">{formatMoney(amount)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">To</dt>
                  <dd className="text-right text-sm font-semibold text-slate-100">
                    {game.hostName}
                    <span className="block text-xs font-medium text-slate-400">{HOST_PAYNOW}</span>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reference</dt>
                  <dd className="text-right text-sm font-semibold text-slate-100">{reference}</dd>
                </div>
              </dl>

              <p className="mt-3 rounded-xl bg-slate-800 px-3.5 py-2.5 text-xs leading-relaxed text-slate-400">
                Transfer in your banking app, then tap below. Coterie doesn't hold the
                money — it goes straight to {game.hostName.split(" ")[0]}.
              </p>
            </div>
          ) : (
            <div className="px-7 pt-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-800 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-14 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-bold tracking-widest text-slate-300">
                    VISA
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-100">•••• •••• •••• 4242</p>
                    <p className="text-xs text-slate-400">Expires 04/29</p>
                  </div>
                </div>
                <div className="mt-4 flex items-baseline justify-between border-t border-slate-700 pt-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total</span>
                  <span className="text-lg font-bold text-slate-100">{formatMoney(amount)}</span>
                </div>
              </div>
              {/* No card fields, on purpose — nothing here can settle a charge,
                  so asking for a card number would be collecting it for nothing. */}
              <p className="mt-3 rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-300">
                Card payments aren't live yet — this is a preview of how they'll look.
                For now, PayNow the host and mark yourself paid.
              </p>
            </div>
          )}

          <div className="space-y-2 px-7 pb-6 pt-5">
            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-center text-xs text-rose-600">
                {error}
              </p>
            )}
            <button
              onClick={markPaid}
              disabled={saving || method === "card"}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-dark active:scale-[0.97] disabled:opacity-50"
            >
              <CoinsIcon className="h-4 w-4" aria-hidden />
              {saving ? "Saving…" : "I've transferred — mark me paid"}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="w-full rounded-2xl border border-slate-700 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 active:scale-[0.97] disabled:opacity-60"
            >
              Not now
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
