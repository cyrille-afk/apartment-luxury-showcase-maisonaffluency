import { describe, expect, it } from "vitest";
import { currencySymbol, formatPdfDate, formatPdfMoney, normalizePdfLocale } from "./pdfFormatting";

describe("PDF formatting", () => {
  const date = new Date(2026, 9, 5);

  it.each([
    ["en-GB", "5 October 2026"],
    ["en-US", "October 5, 2026"],
    ["en-SG", "5 October 2026"],
    ["iso", "2026-10-05"],
  ])("formats the %s date preset", (locale, expected) => {
    expect(formatPdfDate(date, locale)).toBe(expected);
  });

  it("keeps two decimals for every currency, including JPY", () => {
    expect(formatPdfMoney(5000000, "EUR", "en-GB")).toBe("€ 50,000.00");
    expect(formatPdfMoney(5000000, "USD", "en-US")).toBe("US$ 50,000.00");
    expect(formatPdfMoney(5000000, "JPY", "en-SG")).toBe("¥ 50,000.00");
  });

  it("uses unambiguous currency symbols and a safe locale fallback", () => {
    expect(currencySymbol("SGD")).toBe("S$");
    expect(currencySymbol("CAD")).toBe("C$");
    expect(normalizePdfLocale("unsupported")).toBe("en-GB");
  });
});