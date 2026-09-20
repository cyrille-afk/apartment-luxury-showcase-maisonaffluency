/**
 * Luxury financial transparency block.
 *
 * Renders the freight breakdown returned by the cross-border matrix and, when
 * the buyer's registration is authority-verified, the EU reverse-charge
 * disclosure that replaces every local VAT line.
 */
import { Check } from "lucide-react";
import {
  isReverseChargeExempt,
  type CrossBorderInvoice,
} from "@/lib/checkout/crossBorderInvoice";

export function CrossBorderFreightBreakdown({
  invoice,
  format,
}: {
  invoice: CrossBorderInvoice | null;
  format: (cents: number) => string;
}) {
  if (!invoice) return null;
  const s = invoice.shipping;
  return (
    <dl className="mt-1.5 space-y-1 font-body font-light text-[10px] leading-relaxed tracking-[0.06em] text-muted-foreground">
      <div className="flex items-baseline justify-between gap-6">
        <dt>{s.freight_label}</dt>
        <dd className="tabular-nums">{format(s.freight_cents)}</dd>
      </div>
      {s.insurance_cents > 0 && (
        <div className="flex items-baseline justify-between gap-6">
          <dt>Transit insurance</dt>
          <dd className="tabular-nums">{format(s.insurance_cents)}</dd>
        </div>
      )}
      {s.white_glove_applied && (
        <div className="flex items-baseline justify-between gap-6">
          <dt>{s.white_glove_label}</dt>
          <dd className="tabular-nums">{format(s.white_glove_cents)}</dd>
        </div>
      )}
    </dl>
  );
}

export function CrossBorderTaxNotice({ invoice }: { invoice: CrossBorderInvoice | null }) {
  if (!isReverseChargeExempt(invoice)) return null;
  const company = invoice?.verified_company_name || invoice?.buyer_tax_id || "your registered entity";
  return (
    <p className="mt-3 flex items-start gap-2 font-body font-light text-[10px] leading-relaxed tracking-[0.06em] text-muted-foreground">
      <Check className="mt-[1px] h-3 w-3 shrink-0 text-foreground" aria-hidden="true" />
      <span>
        B2B Trade Status Validated: EU Reverse-Charge Protocol Applied (0% VAT). Invoicing
        registered to {company}.
      </span>
    </p>
  );
}
