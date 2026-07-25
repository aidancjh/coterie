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
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
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

// Alpha-weighted box downscale.
function downscale(img, tw, th) {
  const { w: sw, h: sh, data: s } = img;
  const out = Buffer.alloc(tw * th * 4);
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor((ty * sh) / th), y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * sh) / th));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor((tx * sw) / tw), x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * sw) / tw));
      let sA = 0, sR = 0, sG = 0, sB = 0, n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * sw + x) * 4, a = s[i + 3];
          sA += a; sR += s[i] * a; sG += s[i + 1] * a; sB += s[i + 2] * a; n++;
        }
      const o = (ty * tw + tx) * 4;
      out[o + 3] = Math.round(sA / n);
      out[o] = sA ? Math.round(sR / sA) : 0;
      out[o + 1] = sA ? Math.round(sG / sA) : 0;
      out[o + 2] = sA ? Math.round(sB / sA) : 0;
    }
  }
  return { w: tw, h: th, data: out };
}

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

// 1. White-text lockups (deliverables)
w(A("lockup-white.png"), darkToWhite(lockup));
w(A("wordmark-white.png"), darkToWhite(wordmark));

// 2. In-app mark (exact copy, used via <img>)
copyFileSync(A("mark-standalone-red.png"), P("logo-mark.png"));
console.log("wrote ./public/logo-mark.png");

// 3. Favicons / app icons (downscaled from the 1024 mark)
w(P("favicon-32x32.png"), downscale(mark, 32, 32));
w(P("apple-touch-icon.png"), downscale(mark, 180, 180));
w(P("pwa-192x192.png"), downscale(mark, 192, 192));
w(P("pwa-512x512.png"), downscale(mark, 512, 512));

// 4. Maskable — mark at ~74% on a white tile (safe zone for Android masking)
{
  const tile = canvas(512, 512, [255, 255, 255]);
  const m = downscale(mark, 380, 380);
  over(tile, m, 66, 66);
  w(P("maskable-512x512.png"), tile);
}

// 5. OG image — mark on a dark canvas
{
  const og = canvas(1200, 630, [15, 23, 42]);
  const m = downscale(mark, 300, 300);
  over(og, m, 150, 165);
  w(P("og-image.png"), og);
}

// 6. favicon.svg — the exact mark wrapped as SVG (crisp at any size)
{
  const b64 = readFileSync(A("mark-standalone-red.png")).toString("base64");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><image href="data:image/png;base64,${b64}" width="1024" height="1024"/></svg>`;
  writeFileSync(P("favicon.svg"), svg);
  console.log("wrote ./public/favicon.svg");
}

console.log("done");
