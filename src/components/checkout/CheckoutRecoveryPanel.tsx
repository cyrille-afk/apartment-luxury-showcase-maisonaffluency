import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/cart";
import { findRecoveryLine, type CheckoutRecovery } from "@/lib/checkout/checkoutRecovery";

export type RecoveryLine = { pickId?: string | null; pairing?: { ruleId: string; optionId: string } | null; unitCents: number; finishLabel?: string | null; currency?: string | null; productPath?: string | null };

/**
 * Shared recovery step for card and bank-wire checkout. Nothing is repriced
 * until the buyer confirms; with several valid prices one must be chosen.
 * Remount with a `key` per rejection so a previous choice never carries over.
 */
export function CheckoutRecoveryPanel({ message, recovery, lines, busy, onConfirm, onRetry, onReselect, className }: {
  message: string;
  recovery: CheckoutRecovery | null;
  lines: RecoveryLine[] | null;
  busy: boolean;
  onConfirm: (chosenCents?: number) => void;
  onRetry: () => void;
  onReselect: (path: string) => void;
  className?: string;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const affected = recovery && lines ? lines[findRecoveryLine(lines, recovery)] : undefined;
  const options = recovery?.reason === "price_changed" && affected ? recovery.priceOptions ?? [] : [];
  const canAccept = recovery?.reason === "price_changed" && !!affected && (options.length ? chosen !== null : !!recovery.currentUnitCents);
  const cur = String(affected?.currency || "USD").toUpperCase();
  return (
    <div role="alert" className={cn("py-12 text-center space-y-4", className)} data-testid="checkout-recovery">
      <p className="text-sm text-muted-foreground">{message}</p>
      {affected && (
        <p className="text-xs text-muted-foreground">
          Your basket and selections{affected.finishLabel ? ` — including ${affected.finishLabel}` : ""} are saved.
          {!options.length && recovery?.currentUnitCents && ` Current price: ${formatMoney(recovery.currentUnitCents, cur)} each.`}
          {options.length > 0 && " Several prices apply to this piece — choose the one matching your selection. Nothing changes until you confirm."}
        </p>
      )}
      {options.length > 0 && (
        <fieldset className="mx-auto max-w-md space-y-2 text-left" aria-label="Choose the current price">
          {options.map((o) => (
            <label key={o.unitCents} className={cn("flex cursor-pointer items-center justify-between gap-3 border px-3 py-2 text-sm", chosen === o.unitCents ? "border-primary bg-primary/5" : "border-border")}>
              <span className="flex items-center gap-2">
                <input type="radio" name="recovery-price" checked={chosen === o.unitCents} onChange={() => setChosen(o.unitCents)} />
                {o.label}
              </span>
              <span>{formatMoney(o.unitCents, cur)}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        {(canAccept || options.length > 0) && (
          <Button type="button" size="sm" onClick={() => onConfirm(chosen ?? undefined)} disabled={busy || !canAccept}>
            {options.length ? "Confirm selected price and retry" : "Accept updated price and retry"}
          </Button>
        )}
        {recovery && recovery.reason !== "price_changed" && affected?.productPath && (
          <Button type="button" size="sm" variant="outline" onClick={() => { if (affected.productPath) onReselect(affected.productPath); }}>{recovery.reason === "unavailable" ? "Enquire on product page" : "Reselect on product page"}</Button>
        )}
        {recovery?.reason !== "unavailable" && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onRetry}>Try again</Button>}
      </div>
    </div>
  );
}
