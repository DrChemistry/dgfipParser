// Wraps pdfjs-dist to extract per-page text grouped into visual lines.
//
// PDF.js gives us a bag of text items per page, each with a transform matrix.
// We group items that share (approximately) the same Y coordinate to recover
// the visual lines that the user sees, then concatenate them in reading order.

import * as pdfjs from "pdfjs-dist";
import type {
  PDFPageProxy,
  TextContent,
  TextItem,
} from "pdfjs-dist/types/src/display/api";
import type { PageLine } from "./amountParser";

/**
 * PDF.js `getTextContent()` aggregates chunks with `for await (...)` over a
 * ReadableStream. WebKit (Tauri/WKWebView) often lacks async-iteration on
 * ReadableStream, which throws "undefined is not a function" near readableStream.
 * We mirror the same aggregation using `getReader().read()` instead.
 */
async function getTextContentAggregated(
  page: PDFPageProxy,
): Promise<TextContent> {
  const stream = page.streamTextContent();
  const reader = stream.getReader();
  const textContent: TextContent = {
    items: [],
    styles: Object.create(null),
    lang: null,
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      textContent.lang ??= value.lang ?? null;
      Object.assign(textContent.styles, value.styles);
      textContent.items.push(...value.items);
    }
  } finally {
    reader.releaseLock();
  }
  return textContent;
}

// Wire the worker. `scripts/copy-pdf-assets.mjs` copies the worker bundle into
// /public so this URL is served from the same origin as the SPA.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

/** Base URL for bundled Liberation/Foxit metric files (trailing slash). */
function bundledStandardFontDataUrl(): string {
  if (typeof document !== "undefined" && document.baseURI) {
    return new URL("standard_fonts/", document.baseURI).href;
  }
  // Vitest / SSR fallback (extractLines is only used in the webview)
  return new URL("standard_fonts/", "http://localhost/").href;
}

// Two text items are considered to be on the same line if their baseline Y
// coordinates differ by less than this value (in PDF user units, i.e. roughly
// one third of a typical line height).
const Y_EPSILON = 2;

interface PositionedItem {
  x: number;
  y: number;
  text: string;
}

function isTextItem(item: unknown): item is TextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "transform" in item
  );
}

function groupItemsIntoLines(items: PositionedItem[]): string[] {
  if (items.length === 0) return [];

  // Sort top-to-bottom (PDF Y grows upward, so descending Y == top first),
  // then left-to-right within each line.
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) > Y_EPSILON) {
      return b.y - a.y;
    }
    return a.x - b.x;
  });

  const lines: string[] = [];
  let currentY = sorted[0].y;
  let currentParts: string[] = [];

  const flush = () => {
    if (currentParts.length === 0) return;
    // Join with a single space; pdfjs already inserts a space when items have
    // non-trivial horizontal gaps, but a defensive join keeps things readable.
    const joined = currentParts.join(" ").replace(/\s+/g, " ").trim();
    if (joined.length > 0) lines.push(joined);
  };

  for (const item of sorted) {
    if (Math.abs(item.y - currentY) > Y_EPSILON) {
      flush();
      currentParts = [];
      currentY = item.y;
    }
    if (item.text.length > 0) {
      currentParts.push(item.text);
    }
  }
  flush();

  return lines;
}

/**
 * Extracts every visible line from a PDF, tagged with its page number (1-based).
 * The input must be the raw bytes of the PDF file.
 */
export async function extractLines(bytes: Uint8Array): Promise<PageLine[]> {
  // pdfjs mutates the buffer it gets; pass a fresh copy so callers can reuse
  // the original Uint8Array safely.
  const data = new Uint8Array(bytes);
  const loadingTask = pdfjs.getDocument({
    data,
    // Don't fetch anything off the network. The CSP also forbids it, but we
    // double-belt this here so any future upstream change keeps us offline.
    disableAutoFetch: true,
    disableRange: true,
    // We don't render fonts, only extract text, so disabling FontFace avoids
    // pulling in font worker resources we don't need.
    disableFontFace: true,
    // With disableFontFace, PDF.js still needs metric data for the 14 standard
    // PDF fonts — ship it under /standard_fonts/ (see scripts/copy-pdf-assets.mjs).
    standardFontDataUrl: bundledStandardFontDataUrl(),
  });
  const doc = await loadingTask.promise;
  try {
    const result: PageLine[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      try {
        const content = await getTextContentAggregated(page);
        console.log("Content:", content);
        const positioned: PositionedItem[] = [];
        for (const raw of content.items) {
          if (!isTextItem(raw)) continue;
          const text = raw.str;
          if (text.length === 0) continue;
          // transform = [a, b, c, d, e, f]; e = x, f = y.
          const x = raw.transform[4] as number;
          const y = raw.transform[5] as number;
          positioned.push({ x, y, text });
        }
        const lines = groupItemsIntoLines(positioned);
        for (const text of lines) {
          result.push({ page: pageNumber, text });
        }
      } finally {
        page.cleanup();
      }
    }
    return result;
  } finally {
    await doc.destroy();
  }
}
