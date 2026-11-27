// Generates the app icons (PNG) without external dependencies: node tools/make-icons.js
// Draws a mint "฿" (a B with a vertical line through it) on a dark background.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const BG = [0x0f, 0x11, 0x14];
const FG = [0x3d, 0xdc, 0x97];

function inRect(x, y, x0, y0, x1, y1) { return x >= x0 && x <= x1 && y >= y0 && y <= y1; }
// Right half of a ring: the bowls of the B
function inHalfRing(x, y, cx, cy, ro, ri) {
  if (x < cx) return false;
  const d = Math.hypot(x - cx, y - cy);
  return d <= ro && d >= ri;
}
function inShape(px, py, scale) {
  const x = 0.5 + (px - 0.5) / scale, y = 0.5 + (py - 0.5) / scale;
  const w = 0.075;
  return (
    inRect(x, y, 0.33, 0.27, 0.33 + w, 0.73) ||               // stem
    inRect(x, y, 0.33, 0.27, 0.53, 0.27 + w) ||               // top bar
    inRect(x, y, 0.33, 0.47, 0.545, 0.47 + w) ||              // middle bar
    inRect(x, y, 0.33, 0.73 - w, 0.545, 0.73) ||              // bottom bar
    inHalfRing(x, y, 0.53, 0.27 + (0.47 + w - 0.27) / 2, (0.47 + w - 0.27) / 2, (0.47 + w - 0.27) / 2 - w) ||
    inHalfRing(x, y, 0.545, 0.47 + (0.73 - 0.47) / 2, (0.73 - 0.47) / 2, (0.73 - 0.47) / 2 - w) ||
    inRect(x, y, 0.47, 0.17, 0.47 + w * 0.8, 0.83)            // baht line
  );
}

function render(size, scale) {
  const SS = 4; // supersampling for smooth edges
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++)
          if (inShape((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, scale)) hits++;
      const a = hits / (SS * SS);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] * (1 - a) + FG[c] * a);
    }
  }
  return png(size, size, raw);
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, "..", "icons");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "apple-touch-icon.png"), render(180, 1));
fs.writeFileSync(path.join(out, "icon-192.png"), render(192, 1));
fs.writeFileSync(path.join(out, "icon-512.png"), render(512, 1));
fs.writeFileSync(path.join(out, "icon-maskable-512.png"), render(512, 0.8));
console.log("icons written to", out);
