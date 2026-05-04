import { describe, expect, it } from "vitest";
import {
  THRESHOLD,
  findMatches,
  formatAmount,
  matchLine,
  parseAmount,
} from "./amountParser";

describe("parseAmount", () => {
  it("parses plain integer", () => {
    expect(parseAmount("50000")).toBe(50000);
  });

  it("parses French integer with regular space", () => {
    expect(parseAmount("50 000")).toBe(50000);
  });

  it("parses French amount with no-break space", () => {
    expect(parseAmount("50\u00A0000,00")).toBe(50000);
  });

  it("parses French amount with narrow no-break space", () => {
    expect(parseAmount("1\u202F234\u202F567,89")).toBe(1234567.89);
  });

  it("parses negative", () => {
    expect(parseAmount("-12,50")).toBe(-12.5);
  });

  it("returns null for garbage", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("12,3,4")).toBeNull();
  });
});

describe("matchLine", () => {
  it("matches a typical DGFIP line", () => {
    const m = matchLine("TOTAL RESTE A PAYER         75 432,10");
    expect(m).not.toBeNull();
    expect(m!.amount).toBe(75432.1);
  });

  it("matches with euro sign and no-break spaces", () => {
    const m = matchLine("TOTAL\u00A0RESTE\u00A0A\u00A0PAYER : 50\u00A0000,01 \u20AC");
    expect(m).not.toBeNull();
    expect(m!.amount).toBeCloseTo(50000.01, 2);
  });

  it("does not match unrelated lines", () => {
    expect(matchLine("Solde a payer 75 432,10")).toBeNull();
    expect(matchLine("TOTAL RESTE")).toBeNull();
  });
});

describe("findMatches", () => {
  it("keeps only amounts strictly above the threshold", () => {
    const lines = [
      { page: 1, text: "Recapitulatif" },
      { page: 1, text: "TOTAL RESTE A PAYER 49 999,99" },
      { page: 2, text: "TOTAL RESTE A PAYER 50 000,00" },
      { page: 3, text: "TOTAL RESTE A PAYER 50 000,01" },
      { page: 4, text: "TOTAL RESTE A PAYER 1 234 567,89" },
    ];
    const matches = findMatches(lines);
    expect(matches).toHaveLength(2);
    expect(matches[0].page).toBe(3);
    expect(matches[0].amount).toBeCloseTo(50000.01, 2);
    expect(matches[1].page).toBe(4);
    expect(matches[1].amount).toBeCloseTo(1234567.89, 2);
  });

  it("handles multiple matches on the same page", () => {
    const lines = [
      {
        page: 7,
        text:
          "TOTAL RESTE A PAYER 60 000,00  ...  TOTAL RESTE A PAYER 80 000,00",
      },
    ];
    const matches = findMatches(lines);
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.amount)).toEqual([60000, 80000]);
  });

  it("ignores 50 000,00 exactly (strictly greater than threshold)", () => {
    const lines = [{ page: 1, text: "TOTAL RESTE A PAYER 50 000,00" }];
    expect(findMatches(lines)).toHaveLength(0);
  });
});

describe("formatAmount", () => {
  it("formats with French currency", () => {
    const formatted = formatAmount(50000.01);
    // Intl output contains a non-breaking space; assert by stripping spaces.
    expect(formatted.replace(/\s/g, "")).toBe("50000,01€");
  });
});

describe("THRESHOLD", () => {
  it("is 50000", () => {
    expect(THRESHOLD).toBe(50000);
  });
});
