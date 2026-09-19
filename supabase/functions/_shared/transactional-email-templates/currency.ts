/**
 * Shared currency formatter for transactional email templates.
 * Produces a clean symbol-prefixed display and removes trailing/duplicate
 * ISO currency codes (e.g. "HK$185,407.19" instead of "HKD HK$185,407.19").
 */

const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  SGD: "S$",
  HKD: "HK$",
  JPY: "¥",
  CHF: "CHF",
  AUD: "A$",
  CAD: "C$",
  CNY: "¥",
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Format a currency value for display in emails.
 *
 * Accepts either a minor-unit amount (number of cents) or a pre-formatted
 * string. Either way the result is symbol-prefixed and never appends the
 * ISO code.
 */
export function formatCurrency(
  value: string | number | null | undefined,
  currency: string | null | undefined,
): string {
  const code = (currency || "USD").toUpperCase();
  const symbol = SYMBOLS[code];

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return symbol ? `${symbol}—` : `${code} —`;
    }
    const digits = code === "JPY" ? 0 : 2;
    const amount = (value / 100).toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    return symbol ? `${symbol}${amount}` : `${code} ${amount}`;
  }

  const str = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!str || str === "—") {
    return symbol ? `${symbol}—` : `${code} —`;
  }

  const trailingCode = new RegExp(`\\s?${code}$`, "i");

  // Already starts with the symbol — just strip any trailing code.
  if (symbol && str.startsWith(symbol)) {
    return str.replace(trailingCode, "").trim();
  }

  // Starts with "CODE SYMBOL amount" (e.g. "EUR €11,100.00" or "EUR€11,100.00").
  if (symbol) {
    const leadingCodeSymbol = new RegExp(
      `^${code}\\s*${escapeRegex(symbol)}\\s*`,
      "i",
    );
    const cleaned = str.replace(leadingCodeSymbol, "");
    if (cleaned !== str) {
      return `${symbol}${cleaned.replace(trailingCode, "").trim()}`;
    }
  }

  // Starts with "CODE amount" (e.g. "HKD 185,407.19").
  if (symbol) {
    const leadingCodeOnly = new RegExp(`^${code}\\s+`, "i");
    const cleaned = str.replace(leadingCodeOnly, "");
    if (cleaned !== str) {
      return `${symbol}${cleaned.replace(trailingCode, "").trim()}`;
    }
  }

  // Ends with trailing code (e.g. "185,407.19 HKD").
  if (symbol) {
    const cleaned = str.replace(trailingCode, "").trim();
    if (cleaned !== str) {
      return `${symbol}${cleaned}`;
    }
  }

  // Fallback: prepend symbol if we have one, otherwise the code.
  return symbol ? `${symbol}${str}` : `${code} ${str}`;
}
