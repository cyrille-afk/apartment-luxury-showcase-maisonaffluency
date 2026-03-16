import { useState } from "react";

export type DisplayCurrency = "original" | "SGD" | "EUR" | "USD";

/** Approximate FX rates to SGD (base). Updated periodically. */
const TO_SGD: Record<string, number> = {
  SGD: 1,
  EUR: 1.46,
  USD: 1.34,
  GBP: 1.70,
};

/** Convert cents in `fromCurrency` → cents in `toCurrency` */
export function convertCents(cents: number, fromCurrency: string, toCurrency: DisplayCurrency): number {
  if (toCurrency === "original" || toCurrency === fromCurrency) return cents;
  const fromRate = TO_SGD[fromCurrency] ?? 1;
  const toRate = TO_SGD[toCurrency] ?? 1;
  return Math.round((cents * fromRate) / toRate);
}

/** Format cents as a price string in the given display currency */
export function formatPriceConverted(
  cents: number,
  originalCurrency: string,
  displayCurrency: DisplayCurrency,
): string {
  const targetCurrency = displayCurrency === "original" ? originalCurrency : displayCurrency;
  const targetCents = convertCents(cents, originalCurrency, displayCurrency);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: targetCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(targetCents / 100);
}

const OPTIONS: { value: DisplayCurrency; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "SGD", label: "SGD" },
  { value: "EUR", label: "EUR" },
  { value: "USD", label: "USD" },
];

interface CurrencyToggleProps {
  value: DisplayCurrency;
  onChange: (v: DisplayCurrency) => void;
  className?: string;
}

export default function CurrencyToggle({ value, onChange, className = "" }: CurrencyToggleProps) {
  return (
    <div className={`flex items-center gap-1 border border-border rounded-md p-0.5 ${className}`}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2 py-1 text-xs font-body rounded transition-colors ${
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
