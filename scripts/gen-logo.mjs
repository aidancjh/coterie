// Self-contained logo asset generator. Avoids `sharp` (its native binary won't
// load from the OneDrive-synced node_modules) by decoding/encoding PNG with
// Node's built-in zlib. Source of truth: assets/*-red.png (the real artwork).
//
//   node scripts/gen-logo.mjs
//
// Produces:
//   assets/lockup-white.png, assets/wordmark-white.png  (black text -> white)
//   public/logo-mark.png                                (copy of the red mark)
//   public/favicon-32x32.png, apple-touch-icon.png,
//   public/pwa-192x192.png, pwa-512x512.png             (downscaled mark)
//   public/maskable-512x512.png                         (mark on white tile)
//   public/og-image.png                                 (mark on dark canvas)
//   public/favicon.svg                                  (mark wrapped as SVG)
//   index.html                                          (splash mark, inlined)
//   brand-exports/*.png                                 (cover banner + logo tiles)
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync, deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const A = (p) => join(root, "assets", p);
const P = (p) => join(root, "public", p);

// ---- CRC32 (for PNG chunks) ------------------------------------------------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// ---- Decode 8-bit PNG (colour type 6 RGBA or 2 RGB) -> {w,h,data:RGBA} ------
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");
  let pos = 8, w = 0, h = 0, ct = 6, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9];
      if (data[8] !== 8) throw new Error("only 8-bit depth supported");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const srcBpp = ct === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * srcBpp;
  const recon = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    for (let x = 0; x < stride; x++) {
      const v = raw[p + x];
      const a = x >= srcBpp ? recon[y * stride + x - srcBpp] : 0;
      const b = y > 0 ? recon[(y - 1) * stride + x] : 0;
      const c = x >= srcBpp && y > 0 ? recon[(y - 1) * stride + x - srcBpp] : 0;
      let r;
      if (ft === 0) r = v;
      else if (ft === 1) r = v + a;
      else if (ft === 2) r = v + b;
      else if (ft === 3) r = v + ((a + b) >> 1);
      else r = v + paeth(a, b, c);
      recon[y * stride + x] = r & 0xff;
    }
    p += stride;
  }
  // normalise to RGBA
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++) {
    data[j] = recon[i * srcBpp];
    data[j + 1] = recon[i * srcBpp + 1];
    data[j + 2] = recon[i * srcBpp + 2];
    data[j + 3] = ct === 6 ? recon[i * srcBpp + 3] : 255;
    j += 4;
  }
  return { w, h, data };
}

// ---- Encode RGBA -> PNG (filter 0 rows) ------------------------------------
function encodePNG({ w, h, data }) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const comp = deflateSync(raw, { level: 9 });
  const chunk = (type, body) => {
    const c = Buffer.alloc(12 + body.length);
    c.writeUInt32BE(body.length, 0);
    c.write(type, 4, "ascii");
    body.copy(c, 8);
    c.writeUInt32BE(crc32(c.subarray(4, 8 + body.length)), 8 + body.length);
    return c;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", comp), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- ops -------------------------------------------------------------------
// Recolour dark (near-black) pixels to white, keep alpha, leave colour (red) px.
function darkToWhite(img) {
  const d = Buffer.from(img.data);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 0 && d[i] < 110 && d[i + 1] < 110 && d[i + 2] < 110) {
      d[i] = d[i + 1] = d[i + 2] = 255;
    }
  }
  return { w: img.w, h: img.h, data: d };
}

// Clip the pinwheel seams flush to the red circle: remove any WHITE pixel that
// falls outside the mark's disc radius. Run on the red source (letters are still
// black, so only the seam protrusions match white-outside-circle) — never the
// disc or the wordmark letters.
function clipProtrusions(img) {
  const { w, h, data } = img;
  const isRed = (i) => data[i + 3] > 140 && data[i] > 150 && data[i + 1] < 95 && data[i + 2] < 95;
  // Disc centre = centroid of red pixels.
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (isRed((y * w + x) * 4)) { sx += x; sy += y; n++; }
  if (!n) return img;
  const cx = sx / n, cy = sy / n;
  // Disc radius = 99th-percentile red distance (ignores any sparse tail outliers).
  const dists = new Float64Array(n);
  let k = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (isRed((y * w + x) * 4)) dists[k++] = Math.hypot(x - cx, y - cy);
  dists.sort();
  const R = dists[Math.floor(n * 0.99)];
  const lim = R * R;
  // Remove WHITE pixels beyond the disc (the protruding seam tips). Letters are
  // black in the red source, so full-image scan never touches them.
  const d = Buffer.from(data);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > lim) d[i + 3] = 0;
      }
    }
  return { w, h, data: d };
}

/**
 * Separable Lanczos-3 resample, in premultiplied alpha.
 *
 * Replaces an earlier box filter that snapped every output pixel to whole source
 * pixels. That had two visible costs on a logo: each output pixel averaged a
 * different *number* of source pixels (3 or 4 at a 3.1× reduction), which puts a
 * stair-step on a circle's edge; and when the target was larger than the source
 * it collapsed to a single source pixel — nearest-neighbour — so any upscale came
 * out blocky. Fractional weights fix both, and premultiplying keeps transparent
 * pixels from bleeding their colour into the edge.
 */
function resample(img, tw, th) {
  const { w: sw, h: sh, data: s } = img;
  const SUPPORT = 3;
  const lanczos = (x) => {
    if (x === 0) return 1;
    const a = Math.abs(x);
    if (a >= SUPPORT) return 0;
    const px = Math.PI * a;
    return (SUPPORT * Math.sin(px) * Math.sin(px / SUPPORT)) / (px * px);
  };
  // Weights for one axis: sample spacing >1 when reducing, so the kernel widens
  // to average the pixels being thrown away instead of point-sampling them.
  const axis = (srcLen, dstLen) => {
    const scale = srcLen / dstLen;
    const step = Math.max(1, scale);
    const radius = SUPPORT * step;
    const rows = [];
    for (let d = 0; d < dstLen; d++) {
      const centre = (d + 0.5) * scale;
      const from = Math.max(0, Math.floor(centre - radius));
      const to = Math.min(srcLen - 1, Math.ceil(centre + radius));
      const ws = [];
      let total = 0;
      for (let i = from; i <= to; i++) {
        const wt = lanczos((i + 0.5 - centre) / step);
        ws.push(wt);
        total += wt;
      }
      rows.push({ from, ws, total: total || 1 });
    }
    return rows;
  };

  // Pass 1: horizontal, into premultiplied floats.
  const cols = axis(sw, tw);
  const tmp = new Float64Array(tw * sh * 4);
  for (let y = 0; y < sh; y++)
    for (let tx = 0; tx < tw; tx++) {
      const { from, ws, total } = cols[tx];
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < ws.length; k++) {
        const i = (y * sw + from + k) * 4;
        const al = s[i + 3] / 255, wt = ws[k];
        r += s[i] * al * wt; g += s[i + 1] * al * wt; b += s[i + 2] * al * wt;
        a += al * wt;
      }
      const o = (y * tw + tx) * 4;
      tmp[o] = r / total; tmp[o + 1] = g / total; tmp[o + 2] = b / total; tmp[o + 3] = a / total;
    }

  // Pass 2: vertical, then unpremultiply. Lanczos can overshoot slightly at a
  // hard edge, so everything is clamped back into range.
  const rows = axis(sh, th);
  const out = Buffer.alloc(tw * th * 4);
  for (let ty = 0; ty < th; ty++) {
    const { from, ws, total } = rows[ty];
    for (let x = 0; x < tw; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < ws.length; k++) {
        const i = ((from + k) * tw + x) * 4, wt = ws[k];
        r += tmp[i] * wt; g += tmp[i + 1] * wt; b += tmp[i + 2] * wt; a += tmp[i + 3] * wt;
      }
      r /= total; g /= total; b /= total; a /= total;
      const al = Math.min(1, Math.max(0, a));
      const o = (ty * tw + x) * 4;
      const px = (v) => Math.min(255, Math.max(0, Math.round(al ? v / al : 0)));
      out[o] = px(r); out[o + 1] = px(g); out[o + 2] = px(b);
      out[o + 3] = Math.round(al * 255);
    }
  }
  return { w: tw, h: th, data: out };
}

// Kept as the name every call site already uses; it resizes either direction now.
const downscale = resample;

// Solid opaque canvas.
function canvas(w, h, [r, g, b]) {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255; }
  return { w, h, data };
}

// Alpha-composite fg over bg at (ox,oy). Mutates bg.
function over(bg, fg, ox, oy) {
  for (let y = 0; y < fg.h; y++)
    for (let x = 0; x < fg.w; x++) {
      const fi = (y * fg.w + x) * 4, a = fg.data[fi + 3] / 255;
      if (!a) continue;
      const bx = ox + x, by = oy + y;
      if (bx < 0 || by < 0 || bx >= bg.w || by >= bg.h) continue;
      const bi = (by * bg.w + bx) * 4;
      for (let k = 0; k < 3; k++) bg.data[bi + k] = Math.round(fg.data[fi + k] * a + bg.data[bi + k] * (1 - a));
      bg.data[bi + 3] = 255;
    }
  return bg;
}

const w = (name, img) => { writeFileSync(name, encodePNG(img)); console.log("wrote", name.replace(root, ".")); };

// ---- run -------------------------------------------------------------------
const mark = decodePNG(readFileSync(A("mark-standalone-red.png")));
const lockup = decodePNG(readFileSync(A("lockup-red.png")));
const wordmark = decodePNG(readFileSync(A("wordmark-red.png")));

// 1. White-text lockups (deliverables) — clip seam protrusions, then whiten text
w(A("lockup-white.png"), darkToWhite(clipProtrusions(lockup)));
w(A("wordmark-white.png"), darkToWhite(clipProtrusions(wordmark)));

// 2. In-app mark (exact copy, used via <img>)
copyFileSync(A("mark-standalone-red.png"), P("logo-mark.png"));
console.log("wrote ./public/logo-mark.png");

// 3. Favicons / app icons — a filled white tile with the mark padded inside,
// NOT a naked transparent downscale. iOS in particular treats apple-touch-icon
// transparency as opaque BLACK (it doesn't composite it against anything), so a
// transparent-background icon shows up as a black square with the mark bleeding
// to the edges once "Add to Home Screen" is used — exactly the bug being fixed
// here. A solid tile matches how every other app icon looks (filled square,
// centered logo with breathing room) and is Apple's own recommendation (opaque,
// no pre-rounded corners — the OS applies the squircle mask itself).
function iconTile(size, padFrac = 0.13) {
  const tile = canvas(size, size, [255, 255, 255]);
  const inner = Math.round(size * (1 - 2 * padFrac));
  const m = downscale(mark, inner, inner);
  const off = Math.round((size - inner) / 2);
  over(tile, m, off, off);
  return tile;
}
// Browser tabs don't have iOS's opaque-transparency problem — they composite
// favicons fine against the tab's own background, and every other site's tab
// icon fills its space with no padding box. A white iconTile() here showed up
// as a visible white border/square around the mark next to other tabs, so
// favicon-32x32.png stays a naked transparent downscale (its pre-4a9aa94 form).
w(P("favicon-32x32.png"), downscale(mark, 32, 32));
w(P("apple-touch-icon.png"), iconTile(180));
w(P("pwa-192x192.png"), iconTile(192));
w(P("pwa-512x512.png"), iconTile(512));

// 4. Maskable — larger safe margin so Android's circular/squircle crop can trim
// the tile edges without ever clipping the mark itself.
w(P("maskable-512x512.png"), iconTile(512, 0.13));

// 5. OG image — mark on a dark canvas
{
  const og = canvas(1200, 630, [15, 23, 42]);
  const m = downscale(mark, 300, 300);
  over(og, m, 150, 165);
  w(P("og-image.png"), og);
}

// 6. favicon.svg — the exact mark wrapped as SVG, no white backing tile (see
// favicon-32x32.png comment above — browser tabs don't need the iOS fix).
{
  const b64 = readFileSync(A("mark-standalone-red.png")).toString("base64");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><image href="data:image/png;base64,${b64}" width="1024" height="1024"/></svg>`;
  writeFileSync(P("favicon.svg"), svg);
  console.log("wrote ./public/favicon.svg");
}

// 7. Boot splash mark — inlined into index.html as a data URI.
//
// The splash is the very first thing painted, before any JS runs. When it
// pointed at /logo-mark.png it depended on a network fetch that the service
// worker never precached, so a reload on a flaky connection (or against a
// sleeping Railway dyno) painted the browser's broken-image icon right in the
// middle of the boot screen. A data URI can't fail: it ships inside the HTML
// the browser already has. Downscaled to 128px because the splash paints it at
// 64 CSS px — the full 1024px artwork would put ~99 KB of base64 in front of
// first paint.
{
  const b64 = encodePNG(downscale(mark, 128, 128)).toString("base64");
  const file = join(root, "index.html");
  const html = readFileSync(file, "utf8");
  const re = /(<!-- splash-mark:start -->)[\s\S]*?(<!-- splash-mark:end -->)/;
  if (!re.test(html)) throw new Error("index.html is missing the splash-mark markers");
  writeFileSync(
    file,
    html.replace(re, `$1\n            <img src="data:image/png;base64,${b64}" alt="Coterie" />\n            $2`)
  );
  console.log(`wrote ./index.html splash mark (${Math.round(b64.length / 1024)} KB base64)`);
}

// 8. Brand exports — standalone files for things outside the app (survey covers,
// slide decks, social profiles). Not used by the app itself; regenerated here so
// they can never drift from the artwork.
//
// Knockout: turn the artwork into pure white with the seams punched out, so it
// can sit on any colour. The white seams inside the red ball become transparent
// (the background shows through them, which is how a reversed logo is meant to
// work), while letters and the ball body become solid white. Alpha is derived
// from how white a pixel is, so the artwork's anti-aliasing survives.
function knockout(img) {
  const { w, h, data } = img;
  const d = Buffer.alloc(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (!a) continue;
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    const whiteness = Math.min(1, Math.max(0, (min - 128) / 127));
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = Math.round(a * (1 - whiteness));
  }
  return { w, h, data: d };
}

/** Crop to the visible ink, so scaling and centring aren't thrown off by the
 *  artwork's own transparent margins. */
function trim(img, threshold = 8) {
  const { w, h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return img;
  const tw = x1 - x0 + 1, th = y1 - y0 + 1;
  const out = Buffer.alloc(tw * th * 4);
  for (let y = 0; y < th; y++)
    data.copy(out, y * tw * 4, ((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + tw) * 4);
  return { w: tw, h: th, data: out };
}

/**
 * Even out the wordmark's letter clearances for the reversed (white-on-colour)
 * lockup, by dropping or inserting empty columns so every interior gap lands in
 * [min, max]. A run of fully empty columns is exactly the *closest* the two
 * neighbouring letters come anywhere, which is what the eye picks up on.
 *
 * Measured on the source artwork at 1056px wide, those clearances are:
 *
 *   c→ball 27 · ball→t 28 · t→e 10 · e→r 19 · r→i 1 · i→e 20
 *
 * Two problems, opposite directions. The ball was kerned as a solid red disc, so
 * knocking it out (the seams break its silhouette) leaves it reading narrower
 * than the 27/28 it was given, and the word splits into three pieces. And the
 * r's arm passes within 1px of the i's dot — everywhere else those two letters
 * are far apart, which is why only the top of the pair looks wrong.
 */
function normalizeGaps(img, { min, max }) {
  const { w: iw, h: ih, data } = img;
  // Segment on solid ink (alpha > 128), not on any ink at all: at the r/i pair
  // the arm's anti-aliased edge reaches the dot's, so a permissive threshold
  // reads them as one glyph and the gap that needs opening disappears.
  const inked = new Array(iw).fill(false);
  for (let x = 0; x < iw; x++)
    for (let y = 0; y < ih; y++)
      if (data[(y * iw + x) * 4 + 3] > 128) { inked[x] = true; break; }
  // Plan per column: keep it, drop it, or keep it and pad after it.
  const drop = new Array(iw).fill(false);
  const pad = new Array(iw).fill(0);
  let run = 0;
  for (let x = 0; x <= iw; x++) {
    if (x < iw && !inked[x]) { run++; continue; }
    const start = x - run;
    // Interior gaps only: a run touching either edge is the artwork's own margin,
    // which trim() removes anyway. Adjusting it would let the drop range below
    // walk past the end of the run and eat into the next glyph.
    if (run && start > 0 && x < iw) {
      if (run > max) {
        // Remove the middle `surplus` columns, so both glyph edges keep equal air
        // and the range provably stays inside the run.
        const surplus = run - max;
        const from = start + Math.floor((run - surplus) / 2);
        for (let k = 0; k < surplus; k++) drop[from + k] = true;
      } else if (run < min) {
        pad[start + Math.floor(run / 2)] = min - run;
      }
    }
    run = 0;
  }
  const cols =
    inked.length - drop.filter(Boolean).length + pad.reduce((a, b) => a + b, 0);
  const out = Buffer.alloc(cols * ih * 4);
  let ox = 0;
  for (let x = 0; x < iw; x++) {
    if (drop[x]) continue;
    for (let y = 0; y < ih; y++)
      data.copy(out, (y * cols + ox) * 4, (y * iw + x) * 4, (y * iw + x) * 4 + 4);
    ox++;
    ox += pad[x]; // inserted columns stay transparent
  }
  return { w: cols, h: ih, data: out };
}

{
  const exports_ = join(root, "brand-exports");
  mkdirSync(exports_, { recursive: true });
  const E = (p) => join(exports_, p);
  const RED = [217, 38, 50]; // #d92632

  // 8a. Wide cover banner: white wordmark centred on brand red. 2400×400 (6:1)
  // is close to the strip a form/site cover actually renders, and because
  // covers are centre-cropped to fit, the wordmark is kept under ~40% of the
  // width so it survives even a hard crop to mobile proportions.
  const cover = (mark, file, CW = 2400, CH = 400) => {
    let mh = Math.round(CH * 0.5);
    let mw = Math.round((mark.w / mark.h) * mh);
    const maxW = Math.round(CW * 0.4);
    if (mw > maxW) { mw = maxW; mh = Math.round((mark.h / mark.w) * mw); }
    const scaled = downscale(mark, mw, mh);
    const bg = canvas(CW, CH, RED);
    // Vertically the wordmark is centred on its ink MASS, not its bounding box.
    // "coterie" is all lowercase with no descenders, so the top third of the box
    // holds nothing but the t stem and the i dot — 10% of the ink in 30% of the
    // height. Centring the box therefore drops the word about 9% of its own
    // height below where the eye expects it, which is what made the spacing look
    // wrong: too much air above, too little below. Horizontal stays on the box,
    // which is what equal left/right margins mean for a single word.
    let mass = 0, massY = 0;
    for (let y = 0; y < mh; y++)
      for (let x = 0; x < mw; x++) {
        const a = scaled.data[(y * mw + x) * 4 + 3];
        mass += a;
        massY += a * y;
      }
    const centroidY = mass ? massY / mass : mh / 2;
    const oy = Math.round(CH / 2 - centroidY);
    over(bg, scaled, Math.round((CW - mw) / 2), oy);
    w(E(file), bg);
    console.log(
      `   wordmark ${mw}×${mh} (${Math.round((mw / CW) * 100)}% of width), ` +
        `optical lift ${Math.round(mh / 2 - centroidY)}px above box-centre`
    );
  };

  /** Widths of the fully empty column runs between glyphs — the clearances. */
  const clearances = (img) => {
    const gaps = [];
    let run = 0;
    for (let x = 0; x < img.w; x++) {
      let any = false;
      for (let y = 0; y < img.h; y++)
        if (img.data[(y * img.w + x) * 4 + 3] > 128) { any = true; break; }
      if (!any) run++;
      else if (run) { gaps.push(run); run = 0; }
    }
    return gaps;
  };

  // Kern BEFORE knocking out. Once the seams are transparent the ball is three
  // separate shapes, and a gap-finder would treat a seam as a letter gap and
  // prise the ball apart. On the red artwork it is one solid disc.
  const clipped = clipProtrusions(wordmark);
  cover(trim(knockout(clipped)), "coterie-cover-red-2400x400.png");
  // 20 is the clearance the wordmark already uses between two ordinary letters,
  // so it's the ceiling; 12 is the floor, enough to part the r's arm from the i's
  // dot without pushing the i off its own spacing.
  const kernedSrc = normalizeGaps(clipped, { min: 12, max: 20 });
  cover(trim(knockout(kernedSrc)), "coterie-cover-red-2400x400-kerned.png");
  console.log(
    `   clearances (artwork px): as drawn ${clearances(clipped).join("·")} ` +
      `→ kerned ${clearances(kernedSrc).join("·")}`
  );
  // Smaller cover for the Tally survey (2026-08-04): the full 2400×400 cover
  // was "covering the entire" mobile screen. First attempt kept the same 6:1
  // ratio at fewer pixels (coterie-cover-red-1800x300-kerned.png) — Aidan
  // confirmed no visible difference, which rules out file weight/resolution:
  // a browser scales an <img> to fit its box regardless of source pixel
  // count, so two files with the same aspect ratio render identically once
  // scaled. That means Tally is almost certainly cropping the cover into a
  // roughly square-ish box on mobile (typical for form-builder hero covers),
  // and a 6:1 source needs a large zoom to fill a near-square crop — that
  // zoom is what "covers everything." A less-wide ratio needs less zoom to
  // fill the same box, so this is 3:1 instead of 6:1 — still NOT verified
  // live (no browser access this session either), so this is the next best
  // guess given the 6:1 result, not a confirmed fix.
  cover(trim(knockout(kernedSrc)), "coterie-cover-red-1500x500-kerned.png", 1500, 500);

  // 8b/8c. Square logo tiles, safe for a circular crop: the mark is padded to
  // 18% a side (more than the app icons' 13%) so a circle mask can't clip it.
  // 1024 rather than 512 because these get zoomed into — the mark artwork is
  // 1024², so the inner 656px is still a reduction and stays crisp.
  const TILE = 1024, PAD = 0.18;
  const inner = Math.round(TILE * (1 - 2 * PAD));
  const off = Math.round((TILE - inner) / 2);
  w(E("coterie-logo-tile-white-1024.png"), iconTile(TILE, PAD));
  {
    const tile = canvas(TILE, TILE, RED);
    over(tile, downscale(knockout(mark), inner, inner), off, off);
    w(E("coterie-logo-tile-red-1024.png"), tile);
  }
}

console.log("done");
