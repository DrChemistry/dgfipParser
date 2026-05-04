// Generates placeholder PNG icons for the Tauri bundle so that `tauri dev`
// and `tauri build` succeed out of the box. The icons are deliberately
// trivial (a flat-colored square with a thin border); replace them with a
// real design via `npx @tauri-apps/cli icon path/to/source.png`.
//
// We hand-roll the PNGs (8-bit RGBA, no filters, raw deflate) using only
// Node built-ins so the script has zero external dependencies.

import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { Buffer } from "node:buffer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const iconsDir = resolve(__dirname, "..", "src-tauri", "icons");

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function makePng(size, [r, g, b, a], borderRgba) {
  const width = size;
  const height = size;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(rowSize * height);
  const borderSize = Math.max(1, Math.floor(size / 32));
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const onBorder =
        x < borderSize ||
        y < borderSize ||
        x >= width - borderSize ||
        y >= height - borderSize;
      const offset = y * rowSize + 1 + x * 4;
      if (onBorder && borderRgba) {
        raw[offset] = borderRgba[0];
        raw[offset + 1] = borderRgba[1];
        raw[offset + 2] = borderRgba[2];
        raw[offset + 3] = borderRgba[3];
      } else {
        raw[offset] = r;
        raw[offset + 1] = g;
        raw[offset + 2] = b;
        raw[offset + 3] = a;
      }
    }
  }

  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function writeIfMissing(path, buffer) {
  if (existsSync(path)) {
    return false;
  }
  writeFileSync(path, buffer);
  return true;
}

ensureDir(iconsDir);

// Brand color: deep blue with a lighter border for some contrast.
const FILL = [79, 140, 255, 255];
const BORDER = [230, 232, 236, 255];

const sizes = [
  { name: "32x32.png", size: 32 },
  { name: "128x128.png", size: 128 },
  { name: "128x128@2x.png", size: 256 },
  { name: "icon.png", size: 512 },
];

let createdAny = false;
for (const { name, size } of sizes) {
  const target = resolve(iconsDir, name);
  if (writeIfMissing(target, makePng(size, FILL, BORDER))) {
    console.log(`[generate-icons] wrote placeholder ${target}`);
    createdAny = true;
  }
}

if (!createdAny) {
  console.log("[generate-icons] all icons already present, skipping.");
}
