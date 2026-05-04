// Detects "TOTAL RESTE A PAYER" lines and extracts the French-formatted amount
// that appears on the same line. Threshold is fixed at 50 000,00 EUR.

export const THRESHOLD = 50000;

export const TARGET_PHRASE = "TOTAL RESTE A PAYER";

export interface PageLine {
  page: number;
  text: string;
}

export interface AmountMatch {
  page: number;
  line: string;
  rawAmount: string;
  amount: number;
}

// Whitespace characters used as thousands separators in French locales:
// regular space, no-break space (U+00A0), narrow no-break space (U+202F).
const FR_SPACE_CLASS = "[\\s\\u00A0\\u202F]";

// Captures something like "1 234 567,89", "50 000,00", "50000,00", "50000".
// Optional leading minus, then groups of digits separated by FR spaces, then
// optional ",dd" decimals.
const AMOUNT_PATTERN = new RegExp(
  `(-?\\d{1,3}(?:${FR_SPACE_CLASS}\\d{3})*(?:,\\d{1,2})?|-?\\d+(?:,\\d{1,2})?)`,
);

// Full-line regex: phrase, then any non-digit/non-minus run, then the amount.
// The phrase tolerates one or more whitespace chars between words (in case the
// PDF text extractor inserts \u00A0 or multiple spaces).
const LINE_PATTERN = new RegExp(
  `TOTAL${FR_SPACE_CLASS}+RESTE${FR_SPACE_CLASS}+A${FR_SPACE_CLASS}+PAYER[^\\d-]*${AMOUNT_PATTERN.source}`,
);

/**
 * Parses a French-formatted amount string into a Number.
 *
 * Accepts: "50 000,00", "50\u00A0000,00", "50000", "1 234 567,89", "-12,50".
 * Returns null if the string cannot be parsed.
 */
export function parseAmount(raw: string): number | null {
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }
  // Strip every whitespace flavour that may be used as thousands separator.
  const stripped = raw.replace(/[\s\u00A0\u202F]/g, "");
  // French decimal comma -> JS decimal point.
  const normalized = stripped.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Formats a number back into French currency notation (e.g. "50 000,00 €").
 * Uses Intl with the fr-FR locale (available in the V8 webview).
 */
export function formatAmount(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Tests a single line for the target phrase + amount and returns the parsed
 * amount or null when the line doesn't match.
 */
export function matchLine(
  text: string,
): { rawAmount: string; amount: number } | null {
  const match = LINE_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  const raw = match[1];
  const amount = parseAmount(raw);
  if (amount === null) {
    return null;
  }
  return { rawAmount: raw, amount };
}

/**
 * Walks every (page, line) pair and returns matches whose amount is strictly
 * greater than the THRESHOLD.
 */
export function findMatches(lines: PageLine[]): AmountMatch[] {
  const out: AmountMatch[] = [];
  for (const { page, text } of lines) {
    // A page may contain several "TOTAL RESTE A PAYER" occurrences if the line
    // grouping is imprecise; scan globally.
    const scanner = new RegExp(LINE_PATTERN.source, "g");
    let m: RegExpExecArray | null;
    while ((m = scanner.exec(text)) !== null) {
      const raw = m[1];
      const amount = parseAmount(raw);
      if (amount !== null && amount > THRESHOLD) {
        out.push({
          page,
          line: text.trim(),
          rawAmount: raw,
          amount,
        });
      }
      // Avoid infinite loops on zero-width matches.
      if (m.index === scanner.lastIndex) scanner.lastIndex++;
    }
  }
  return out;
}
