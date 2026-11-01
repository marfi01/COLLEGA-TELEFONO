// Genera icon.png e icon.ico senza dipendenze
const zlib = require('zlib');
const fs = require('fs');
const N = 256;
const px = Buffer.alloc(N * N * 4);

function inRound(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function set(x, y, r, g, b, a = 255) { const i = (y * N + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; }

for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  if (inRound(x, y, 8, 8, 247, 247, 52)) {
    const t = y / N;
    set(x, y, Math.round(46 - 20 * t), Math.round(139 - 40 * t), Math.round(255 - 30 * t));
    if (inRound(x, y, 78, 36, 178, 220, 18)) {            // telefono
      set(x, y, 255, 255, 255);
      if (inRound(x, y, 88, 56, 168, 190, 6)) set(x, y, 30, 100, 220); // schermo
      if ((x - 128) ** 2 + (y - 205) ** 2 <= 36) set(x, y, 30, 100, 220); // tasto
    }
    // frecce di scambio
    if (x >= 186 && x <= 226 && y >= 100 && y <= 110) set(x, y, 255, 255, 255);
    if (x >= 214 && x <= 238 && Math.abs(y - 105) <= 238 - x - 0 && x > 214) set(x, y, 255, 255, 255);
    if (x >= 30 && x <= 70 && y >= 146 && y <= 156) set(x, y, 255, 255, 255);
    if (x <= 42 && x >= 18 && Math.abs(y - 151) <= x - 18) set(x, y, 255, 255, 255);
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
const raw = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) { raw[y * (N * 4 + 1)] = 0; px.copy(raw, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync('icon.png', png);

const hdr = Buffer.alloc(22);
hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(1, 4);
hdr[6] = 0; hdr[7] = 0; hdr.writeUInt16LE(1, 10); hdr.writeUInt16LE(32, 12);
hdr.writeUInt32LE(png.length, 14); hdr.writeUInt32LE(22, 18);
fs.writeFileSync('icon.ico', Buffer.concat([hdr, png]));
console.log('icon ok');
