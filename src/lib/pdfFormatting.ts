export const PDF_LOCALE_PRESETS = ["en-GB", "en-US", "en-SG", "iso"] as const;

export type PdfLocalePreset = (typeof PDF_LOCALE_PRESETS)[number];

export const DEFAULT_PDF_LOCALE: PdfLocalePreset = "en-GB";

export const PDF_LOCALE_LABELS: Record<PdfLocalePreset, string> = {
  "en-GB": "United Kingdom — 5 October 2026",
  "en-US": "United States — October 5, 2026",
  "en-SG": "Singapore — 5 October 2026",
  iso: "ISO — 2026-10-05",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  SGD: "S$",
  USD: "US$",
  EUR: "€",
  GBP: "£",
  HKD: "HK$",
  CHF: "CHF",
  AED: "AED",
  AUD: "A$",
  CAD: "C$",
  JPY: "¥",
  CNY: "CN¥",
};

export function normalizePdfLocale(value?: string | null): PdfLocalePreset {
  return PDF_LOCALE_PRESETS.includes(value as PdfLocalePreset)
    ? (value as PdfLocalePreset)
    : DEFAULT_PDF_LOCALE;
}

export function currencySymbol(currency: string): string {
  const code = String(currency || "SGD").toUpperCase();
  return CURRENCY_SYMBOLS[code] ?? code;
}

export function formatPdfMoney(
  cents: number | null | undefined,
  currency: string,
  locale?: string | null,
  nullLabel = "TBD",
): string {
  if (cents == null) return nullLabel;
  const preset = normalizePdfLocale(locale);
  const numberLocale = preset === "iso" ? "en-GB" : preset;
  const amount = new Intl.NumberFormat(numberLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(Math.abs(cents) / 100);
  const sign = cents < 0 ? "−" : "";
  return `${sign}${currencySymbol(currency)} ${amount}`;
}

export function formatPdfDate(date: Date, locale?: string | null): string {
  const preset = normalizePdfLocale(locale);
  if (preset === "iso") {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return new Intl.DateTimeFormat(preset, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}