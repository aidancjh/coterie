import { useEffect, useMemo, useRef, useState } from "react";
import { searchCourts, suggestCourt, isExactCourt, type Court } from "../lib/courts";
import { MapPinIcon, SearchIcon } from "./icons";

/**
 * Venue field for the create/edit game form: a search box over the known
 * Singapore courts (see src/lib/courts.ts) rather than a free-text field.
 *
 * Picking a court fills in its region and neighbourhood too, which is what
 * makes the region filter on Browse work. A host with a venue we don't know
 * can still type it — they just pick the region by hand afterwards.
 *
 * Typos get a "Did you mean" line rather than silent failure, because a host
 * who typed "Clemeti" and sees an empty list will assume the court isn't
 * listed and type a custom name, which costs us the region.
 */
export default function CourtPicker({
  value,
  onChange,
  onPick,
  invalid,
  inputRef,
}: {
  /** The venue text as saved on the game. */
  value: string;
  /** Host typed something. The venue is now custom until they pick a court. */
  onChange: (location: string) => void;
  /** Host chose a court from the list — caller fills in area and region. */
  onPick: (court: Court) => void;
  invalid?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => searchCourts(value, 8), [value]);
  const exact = useMemo(() => isExactCourt(value), [value]);
  const suggestion = useMemo(() => (open ? null : suggestCourt(value)), [value, open]);

  // Reset the highlight whenever the list itself changes, so Enter can never
  // select a court that scrolled out from under the highlight.
  useEffect(() => setActive(0), [value]);

  // Close on any click outside. A blur handler would fire before the click
  // on a list item registered, so the pick would be lost.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  // Keep the highlighted row visible when arrowing past the fold.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const pick = (court: Court) => {
    onPick(court);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (matches.length === 0) return;
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + dir + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      // Only swallow Enter when it's actually choosing something — otherwise
      // it must fall through and submit the form as usual.
      if (open && matches[active]) {
        e.preventDefault();
        pick(matches[active]);
      }
    } else if (e.key === "Escape") {
      if (open) { e.preventDefault(); setOpen(false); }
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl border ${
          invalid ? "border-rose-500" : "border-slate-700"
        } bg-slate-900 px-3 transition focus-within:border-slate-400`}
      >
        <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search courts — e.g. Bedok, OCBC, NTU"
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="court-list"
          autoComplete="off"
        />
      </div>

      {/* Confirmation that the venue is one we know, so the host can trust the
          region was filled in for them. */}
      {!open && exact && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
          <MapPinIcon className="h-3 w-3 shrink-0" />
          {exact.area} · {exact.region} · {exact.kind}
        </p>
      )}

      {/* Typo rescue. Shown only when the list is closed — while it's open the
          court is already sitting right there to be clicked. */}
      {suggestion && !exact && (
        <p className="mt-1.5 text-[11px] text-slate-400">
          Did you mean{" "}
          <button
            type="button"
            onClick={() => pick(suggestion)}
            className="font-semibold text-brand underline"
          >
            {suggestion.name}
          </button>
          ?
        </p>
      )}

      {!open && !exact && !suggestion && value.trim() && (
        <p className="mt-1.5 text-[11px] text-slate-400">
          Not a listed court — pick the region below so players can find it.
        </p>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
          <ul id="court-list" ref={listRef} role="listbox" className="max-h-60 overflow-y-auto">
            {matches.map((c, i) => (
              <li key={c.name} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  // mousedown, not click: the outside-click listener would
                  // otherwise close the list before click fired.
                  onMouseDown={(e) => { e.preventDefault(); pick(c); }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition ${
                    i === active ? "bg-slate-800" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-100">{c.name}</span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {c.area} · {c.kind}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                    {c.region}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Keeping a custom venue is a first-class option, not a dead end —
              plenty of games happen at condos, churches and school halls we
              haven't listed. */}
          {value.trim() && !exact && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setOpen(false); }}
              className="block w-full border-t border-slate-800 px-3 py-2.5 text-left text-xs text-slate-400 transition hover:bg-slate-800"
            >
              Use “<span className="font-semibold text-slate-200">{value.trim()}</span>” as typed
            </button>
          )}

          {matches.length === 0 && !value.trim() && (
            <p className="px-3 py-3 text-xs text-slate-400">Start typing to find a court.</p>
          )}
        </div>
      )}
    </div>
  );
}
