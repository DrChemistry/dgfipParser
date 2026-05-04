// Copies the pdf.js worker bundle into /public so the Vite dev server and the
// Tauri production build serve it from the same origin as the SPA. PDF.js
// requires the worker URL to be reachable; we ship it locally to keep the app
// fully offline.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const projectRoot = resolve(__dirname, "..");
const publicDir = resolve(projectRoot, "public");

let workerSource;
try {
  workerSource = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
} catch {
  // Optional dependency not yet installed (e.g. during a partial install).
  // The script must not crash npm install, just bail out quietly.
  console.warn(
    "[copy-pdf-worker] pdfjs-dist not installed yet, skipping worker copy.",
  );
  process.exit(0);
}

if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

const target = resolve(publicDir, "pdf.worker.min.mjs");
copyFileSync(workerSource, target);
console.log(`[copy-pdf-worker] copied ${workerSource} -> ${target}`);
