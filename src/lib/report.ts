import type { AmountMatch } from "./amountParser";
import { findMatches } from "./amountParser";
import { extractLines } from "./pdfParser";
import { basename, readPdfBytes } from "./fileLoader";

export type FileStatus = "pending" | "processing" | "done" | "error";

export interface FileReport {
  path: string;
  name: string;
  status: FileStatus;
  matches: AmountMatch[];
  error?: string;
  /** Number of pages successfully scanned (undefined while pending). */
  pageCount?: number;
}

export function makeInitialReport(path: string): FileReport {
  return {
    path,
    name: basename(path),
    status: "pending",
    matches: [],
  };
}

/**
 * Reads, parses and scans a single PDF. Mutates the supplied report in-place
 * so that callers (Vue refs) can render progress as it happens.
 */
export async function processFile(report: FileReport): Promise<void> {
  report.status = "processing";
  report.error = undefined;
  report.matches = [];
  try {
    const bytes = await readPdfBytes(report.path);
    const lines = await extractLines(bytes);
    report.matches = findMatches(lines);
    // Page count = max page index seen, falling back to 0 for empty docs.
    report.pageCount = lines.reduce((acc, l) => Math.max(acc, l.page), 0);
    report.status = "done";
  } catch (err) {
    report.status = "error";
    report.error = err instanceof Error ? err.message : String(err);
  }
}
