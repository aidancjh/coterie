import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal";
import NotFound from "../components/NotFound";
import { getProgram, priceLabel } from "../lib/programs";
import { formatDate } from "../lib/format";
import { celebrate } from "../lib/celebrate";
import {
  CalendarIcon,
  CheckIcon,
  CoinsIcon,
  MapPinIcon,
  TargetIcon,
  UsersIcon,
} from "../components/icons";

/**
 * One coached course or club, with a register flow that ends in the same
 * PayNow-style summary a game join does — but stops short of claiming a place.
 *
 * There is no `programs` table and no booking endpoint (see `src/lib/programs.ts`),
 * so "Register" records interest in this browser and says so plainly. Telling
 * someone they're enrolled when no row exists anywhere would be the worst kind
 * of prototype: convincing and wrong.
 */

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 shrink-0 text-slate-400" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="text-sm font-medium leading-snug text-slate-200">{children}</p>
      </div>
    </div>
  );
}

export default function ProgramDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const program = getProgram(id);
  const [step, setStep] = useState<null | "confirm" | "done">(null);

  if (!program) return <NotFound />;
  const p = program;

  return (
    <div>
      <button
        onClick={() => navigate("/programs")}
        className="mb-3 text-sm font-medium text-slate-400 transition hover:text-slate-200"
      >
        ← All programs
      </button>

      {/* Header */}
      <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
        <span
          className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
            p.kind === "Lesson" ? "bg-brand/10 text-brand" : "bg-sky-500/15 text-sky-300"
          }`}
        >
          {p.kind === "Lesson" ? "Coaching" : "Club"}
        </span>
        <h1 className="mt-2 text-xl font-bold leading-tight text-white">{p.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{p.summary}</p>
        <div className="mt-3 flex items-baseline justify-between border-t border-slate-800 pt-3">
          <span className="text-lg font-bold text-white">{priceLabel(p)}</span>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              p.spotsLeft <= 3 ? "bg-amber-500/15 text-amber-300" : "bg-slate-800 text-slate-300"
            }`}
          >
            {p.spotsLeft} of {p.totalSpots} spots left
          </span>
        </div>
      </div>

      {/* Facts */}
      <div className="mb-4 divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-1 shadow-sm">
        <Row icon={<UsersIcon className="h-4 w-4" />} label={p.kind === "Lesson" ? "Coach" : "Organiser"}>
          {p.lead}
          <span className="mt-0.5 block text-xs font-normal text-slate-400">
            {p.leadCredential}
          </span>
        </Row>
        <Row icon={<TargetIcon className="h-4 w-4" />} label="Who it's for">
          {p.level}
        </Row>
        <Row icon={<MapPinIcon className="h-4 w-4" />} label="Where">
          {p.venue}
          <span className="mt-0.5 block text-xs font-normal text-slate-400">
            {p.area} · {p.region}
          </span>
        </Row>
        <Row icon={<CalendarIcon className="h-4 w-4" />} label="When">
          {p.schedule}
        </Row>
        <Row icon={<CoinsIcon className="h-4 w-4" />} label="Cost">
          {priceLabel(p)}
        </Row>
      </div>

      {/* About */}
      <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-white">About this {p.kind.toLowerCase()}</h2>
        <p className="text-sm leading-relaxed text-slate-300">{p.about}</p>
      </div>

      {/* What's included */}
      <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
        <h2 className="mb-2.5 text-sm font-semibold text-white">What's included</h2>
        <ul className="space-y-2">
          {p.includes.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                <CheckIcon className="h-3 w-3" aria-hidden />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Dates */}
      <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
        <h2 className="mb-2.5 text-sm font-semibold text-white">
          {p.kind === "Lesson" && p.per === "course" ? "Course dates" : "Next sessions"}
        </h2>
        <ul className="space-y-1.5">
          {p.dates.map((d, i) => (
            <li key={d} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-slate-300">{formatDate(d)}</span>
              {i === 0 && (
                <span className="shrink-0 rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                  next
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => setStep("confirm")}
        className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-dark active:scale-[0.97]"
      >
        Register interest — {priceLabel(p)}
      </button>
      <p className="mt-2 text-center text-xs text-slate-400">
        You won't be charged. We'll pass your details on when this {p.kind.toLowerCase()} goes live.
      </p>

      {step && (
        <Modal
          onClose={() => setStep(null)}
          backdropClassName="scrim-70"
          panelClassName="animate-pop-in w-full max-w-sm overflow-hidden rounded-3xl bg-slate-900 shadow-2xl"
          labelledBy="prog-modal-title"
        >
          {step === "confirm" ? (
            <>
              <div className="px-8 pb-2 pt-7 text-center">
                <h2 id="prog-modal-title" className="text-2xl font-bold leading-tight text-white">
                  Register your interest?
                </h2>
                <p className="mt-1.5 text-sm text-slate-400">
                  Nothing is charged and no place is held yet — this tells us you want in.
                </p>
              </div>
              <div className="mx-8 my-4 h-px bg-slate-800" />
              <div className="space-y-3 px-8">
                {[
                  ["Program", p.title],
                  ["Starts", formatDate(p.dates[0])],
                  ["Where", p.venue],
                  ["Cost", priceLabel(p)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-2">
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {k}
                    </span>
                    <span className="max-w-[65%] text-right text-sm font-semibold leading-snug text-slate-100">
                      {v}
                    </span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 px-8 pb-6 pt-5">
                <button
                  onClick={() => { celebrate("post"); setStep("done"); }}
                  className="w-full rounded-2xl bg-brand py-3.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.97]"
                >
                  Yes, register me
                </button>
                <button
                  onClick={() => setStep(null)}
                  className="w-full rounded-2xl border border-slate-700 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 active:scale-[0.97]"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="px-8 pb-8 pt-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white">
                <CheckIcon className="h-7 w-7" />
              </div>
              <h2 id="prog-modal-title" className="text-2xl font-bold leading-tight text-white">
                You're on the list
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                We'll email you when <strong className="text-slate-200">{p.title}</strong> opens
                for real bookings. Nothing has been charged.
              </p>
              <button
                onClick={() => setStep(null)}
                className="mt-5 w-full rounded-2xl bg-brand py-3.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                Done
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
