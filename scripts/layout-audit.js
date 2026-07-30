// Layout auditor — paste into the browser console on any page of the app.
//
//   __audit()            check the page as it stands
//   await __go("/chats") navigate within the SPA, then __audit() again
//
// It reports only faults that are measurable: a panel showing a strip of its own
// background because its contents didn't stretch, text clipped with no ellipsis
// to signal it, something poking outside the viewport, sideways page scroll, ink
// the same colour as what's behind it. It says nothing about taste.
//
// Written for the bug that prompted it: in the 2-column browse grid, every card
// in a row is stretched to the tallest one, but GameCard's inner row kept its
// natural height — so on the shorter card the red date rail stopped ~23px above
// the bottom and left a white strip inside the card. That is the shape of fault
// `stretched-not-filled` looks for, and it generalises to any card in this app.
//
// Known-intentional patterns are excluded deliberately: anything inside an
// `aria-hidden` subtree (the partial-fill star overlay clips on purpose) and
// `.sr-only` text (clipped to 1px on purpose).
(() => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const rgbCache = new Map();
  /** Resolve ANY css colour — including oklch(), which cannot be compared
   *  component-wise against rgb() — to [r,g,b,a] by actually painting it. */
  const toRgb = (css) => {
    if (rgbCache.has(css)) return rgbCache.get(css);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    try { ctx.fillStyle = css; } catch { /* leave black */ }
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const out = [r, g, b, a / 255];
    rgbCache.set(css, out);
    return out;
  };

  const label = (el) => {
    const cls = (el.className || "").toString().split(/\s+/).filter(Boolean).slice(0, 4).join(".");
    const txt = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${txt ? ` "${txt}"` : ""}`;
  };

  window.__audit = () => {
    const findings = [];
    const add = (kind, el, detail) => findings.push({ kind, el: label(el), detail });
    const vw = document.documentElement.clientWidth;

    if (document.documentElement.scrollWidth > vw + 1)
      findings.push({ kind: "page-h-scroll", el: "html", detail: `scrollWidth ${document.documentElement.scrollWidth} > ${vw}` });

    const visible = [...document.querySelectorAll("body *")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    });

    for (const el of visible) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const decorative = !!el.closest("[aria-hidden='true']");
      const srOnly = el.clientWidth <= 1 || el.clientHeight <= 1 || cs.clipPath !== "none" || cs.clip !== "auto";

      // Poking out of, or past, the viewport.
      if (r.width > vw + 1) add("wider-than-viewport", el, `${Math.round(r.width)}px > ${vw}px`);
      if ((r.left < -1 || r.right > vw + 1) && cs.position !== "fixed" && !decorative)
        add("outside-viewport", el, `left ${Math.round(r.left)} right ${Math.round(r.right)}`);

      // A stretched panel whose contents didn't stretch with it, so it shows a
      // band of its own background. This is the GameCard fault.
      const parent = el.parentElement;
      const pcs = parent ? getComputedStyle(parent) : null;
      const stretched = pcs && /flex|grid/.test(pcs.display) && /stretch|normal/.test(pcs.alignItems);
      const skinned = toRgb(cs.backgroundColor)[3] > 0 || parseFloat(cs.borderTopLeftRadius) >= 8;
      if (stretched && skinned && el.children.length && !/flex|grid/.test(cs.display)) {
        const padB = parseFloat(cs.paddingBottom);
        const pad = parseFloat(cs.paddingTop) + padB;
        const bottom = Math.max(...[...el.children].map((k) => k.getBoundingClientRect().bottom));
        const slack = r.bottom - padB - bottom;
        if (slack > 4 && pad < slack)
          add("stretched-not-filled", el, `${Math.round(slack)}px of empty ${cs.backgroundColor} below its content`);
      }

      // Clipped text with nothing to signal the clip.
      if (!decorative && !srOnly && el.children.length === 0 && (el.textContent || "").trim()) {
        if (el.scrollWidth > el.clientWidth + 2 && /hidden|clip/.test(cs.overflowX) && cs.textOverflow !== "ellipsis")
          add("text-clipped", el, `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
      }
      if (!decorative && !srOnly && /hidden|clip/.test(cs.overflowY) && el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 6)
        add("content-clipped-vertically", el, `${el.scrollHeight - el.clientHeight}px hidden`);

      // Ink the same colour as the surface behind it. Only opaque surfaces count:
      // a 15% tint composites over whatever is under it, so comparing against the
      // tint's own colour proves nothing.
      if (!decorative && !srOnly && el.children.length === 0 && (el.textContent || "").trim()) {
        let n = el, bg = [255, 255, 255, 1];
        while (n && n !== document.documentElement) {
          const c = toRgb(getComputedStyle(n).backgroundColor);
          if (c[3] >= 0.6) { bg = c; break; }
          n = n.parentElement;
        }
        const ink = toRgb(cs.color);
        const dist = Math.abs(ink[0] - bg[0]) + Math.abs(ink[1] - bg[1]) + Math.abs(ink[2] - bg[2]);
        if (ink[3] > 0.5 && dist < 24) add("text-invisible", el, `${cs.color} on ${bg.slice(0, 3).join(",")}`);
      }
    }

    const seen = new Map();
    for (const f of findings) {
      const k = `${f.kind} | ${f.el} | ${f.detail}`;
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    return {
      url: location.pathname,
      vw,
      total: findings.length,
      issues: [...seen].map(([k, n]) => (n > 1 ? `${k} (x${n})` : k)).slice(0, 20),
    };
  };

  /** Navigate inside the SPA without a reload, so __audit survives. */
  window.__go = async (path, settleMs = 1400) => {
    history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
    await new Promise((r) => setTimeout(r, settleMs));
    return location.pathname;
  };

  return "layout audit ready — call __audit(), or await __go('/path') first";
})();
