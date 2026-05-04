// Copies PDF.js assets into /public so the Vite dev server and the Tauri build
// serve them from the same origin (fully offline, no CDN):
// - pdf.worker.min.mjs  (required for the worker thread)
// - standard_fonts/     (required when disableFontFace is true; see getDocument
//   `standardFontDataUrl` in the PDF.js API)
import { copyFileSync, existsSync, mkdirSync, cpSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const projectRoot = resolve(__dirname, "..");
const publicDir = resolve(projectRoot, "public");

let pdfjsRoot;
try {
  pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));
} catch {
  console.warn(
    "[copy-pdf-assets] pdfjs-dist not installed yet, skipping asset copy.",
  );
  process.exit(0);
}

if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

// 1) Worker
const workerSource = join(pdfjsRoot, "build", "pdf.worker.min.mjs");
const workerTarget = join(publicDir, "pdf.worker.min.mjs");
copyFileSync(workerSource, workerTarget);
console.log(`[copy-pdf-assets] worker: ${workerSource} -> ${workerTarget}`);

// 2) Standard font metrics (Liberation / Foxit fallbacks for non-embedded fonts)
const standardFontsSrc = join(pdfjsRoot, "standard_fonts");
const standardFontsDest = join(publicDir, "standard_fonts");
cpSync(standardFontsSrc, standardFontsDest, { recursive: true });
console.log(
  `[copy-pdf-assets] standard_fonts: ${standardFontsSrc} -> ${standardFontsDest}`,
);
