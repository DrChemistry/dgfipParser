import type { FileReport } from "./report";

function escape(field: string | number): string {
  const s = String(field);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Builds a CSV with one row per match (above threshold). When a file has no
 * matches, no row is emitted for it. The first row is a header.
 */
export function buildCsv(reports: FileReport[]): string {
  const header = ["Fichier", "Page", "Montant brut", "Montant", "Ligne"];
  const rows: string[] = [header.map(escape).join(",")];
  for (const report of reports) {
    for (const match of report.matches) {
      rows.push(
        [
          escape(report.name),
          escape(match.page),
          escape(match.rawAmount),
          escape(match.amount.toFixed(2)),
          escape(match.line),
        ].join(","),
      );
    }
  }
  return rows.join("\n");
}

/**
 * Triggers a "Save As" download of the CSV in the webview. We use a Blob URL
 * because we don't want to round-trip via Tauri's fs plugin for an export
 * that the user manages in their own filesystem.
 */
export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel reads UTF-8 correctly when opening the file directly.
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revocation so the click handler has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
