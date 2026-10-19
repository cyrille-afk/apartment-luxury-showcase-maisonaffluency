import { quoteChargeBreakdown, type QuoteCharge } from "@/lib/quoteChargeBreakdown";

type Props = {
  charges: QuoteCharge[];
  goodsCents: number;
  taxRate: number;
  taxLabel: string;
  nonTaxableCents: number;
  format: (cents: number) => string;
};

export default function QuoteChargeBreakdown({ charges, goodsCents, taxRate, taxLabel, nonTaxableCents, format }: Props) {
  if (!charges.length) return null;
  const rows = quoteChargeBreakdown(charges, goodsCents, taxRate, nonTaxableCents);
  return (
    <section aria-label="Additional charge payment breakdown" className="font-body text-[11px] border-y border-border py-3 my-3 space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="space-y-1">
          <div className="flex justify-between gap-4 text-foreground">
            <span className="min-w-0 break-words font-medium">{row.label}</span>
            <span className="shrink-0 tabular-nums">{format(row.amountCents)}</span>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-muted-foreground">
            {[
              [`${taxLabel} (${taxRate}%)`, row.gstCents],
              ["Including tax", row.totalCents],
              ["60% deposit share", row.depositCents],
              ["40% balance share", row.balanceCents],
            ].map(([label, amount]) => (
              <div key={String(label)}>
                <dt>{label}</dt>
                <dd className="tabular-nums text-foreground/80">{format(Number(amount))}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}