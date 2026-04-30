/**
 * QuoteDisplayCurrencyToggle
 * --------------------------
 * Pill toggle that switches the totals block between the quote's working
 * currency and the GBP DDP landed-cost view (Paris→London).
 */
import { Truck } from "lucide-react";

interface Props {
  value: "quote" | "gbp";
  onChange: (v: "quote" | "gbp") => void;
  quoteCurrency: string;
  disabled?: boolean;
}

export const QuoteDisplayCurrencyToggle = ({
  value,
  onChange,
  quoteCurrency,
  disabled,
}: Props) => {
  const base =
    "px-3 py-1 font-body text-[11px] uppercase tracking-wider transition-colors";
  const active = "bg-foreground text-background";
  const inactive = "text-muted-foreground hover:text-foreground";

  return (
    <div className="flex items-center justify-end gap-2 mb-2">
      <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
        Display
      </span>
      <div
        role="group"
        className={`inline-flex border border-border rounded-full overflow-hidden ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        <button
          type="button"
          onClick={() => onChange("quote")}
          className={`${base} ${value === "quote" ? active : inactive}`}
          aria-pressed={value === "quote"}
        >
          {quoteCurrency}
        </button>
        <button
          type="button"
          onClick={() => onChange("gbp")}
          className={`${base} flex items-center gap-1 ${value === "gbp" ? active : inactive}`}
          aria-pressed={value === "gbp"}
          title="GBP — UK DDP landed cost (Paris → London)"
        >
          <Truck className="w-3 h-3" />
          GBP DDP
        </button>
      </div>
    </div>
  );
};

export default QuoteDisplayCurrencyToggle;
