import type { QuotePdfArgs } from "@/lib/quotePdf";
import { computePdfTotals } from "@/lib/quoteConsistency";
import { formatPdfMoney } from "@/lib/pdfFormatting";
import { calculateCeilingBudget } from "@/lib/ceilingBudget";
import { quoteReviewNetCents } from "@/lib/quoteReview";

type Props = {
  args: QuotePdfArgs;
  lineDiscounts: number[];
  clientSafe: boolean;
};

export default function QuoteReviewSummary({ args, lineDiscounts, clientSafe }: Props) {
  const money = (cents: number | null | undefined) => cents == null ? "Price upon Request" : formatPdfMoney(cents, args.currency, args.formatting?.locale);
  const totals = computePdfTotals(args);
  const ceiling = args.ceilingBudget ? calculateCeilingBudget(args.ceilingBudget) : null;
  return (
    <section aria-label="Selected pieces and quote pricing" className="space-y-5 font-body text-xs">
      <div className="flex flex-wrap justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="font-medium text-foreground">{args.clientCompany || args.clientName || "No client selected"}</p>
          {args.projectName && <p className="mt-1 text-muted-foreground">{args.projectName}</p>}
        </div>
        <p className="text-muted-foreground">{args.lines.length} pieces · {args.lines.reduce((sum, line) => sum + line.quantity, 0)} units · {args.currency}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="pb-3 font-normal">Piece / finish</th>
              <th className="pb-3 px-3 text-right font-normal">Qty</th>
              <th className="pb-3 px-3 text-right font-normal">Unit price</th>
              <th className="pb-3 pl-3 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {args.lines.map((line, index) => (
              <tr key={index} className="border-b border-border align-top">
                <td className="py-3">
                  <div className="flex gap-3">
                    {line.imageUrl && <img src={line.imageUrl} alt={line.productName} className="h-16 w-16 shrink-0 object-contain bg-muted" />}
                    <div className="min-w-0">
                      <p className="text-muted-foreground">{line.brandName}</p>
                      <p className="mt-1 font-medium text-foreground">{line.productName}</p>
                      {line.variantLabel && <p className="mt-1 text-muted-foreground">{line.variantLabel}</p>}
                      {line.fabricLabel && <p className="mt-1 text-muted-foreground">{line.fabricLabel}</p>}
                      {line.woodFinishLabel && <p className="mt-1 text-muted-foreground">{line.woodFinishLabel}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3 text-right tabular-nums">{line.quantity}</td>
                <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{money(line.unitPriceCents)}</td>
                <td className="py-3 pl-3 text-right tabular-nums whitespace-nowrap">
                  {money(line.lineTotalCents)}
                  {!clientSafe && args.tradeDiscountApplied && line.lineTotalCents != null && (
                    <div data-trade-sensitive className="mt-1 text-muted-foreground">Net {money(quoteReviewNetCents(line, lineDiscounts[index] ?? 0))}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto max-w-sm space-y-2 tabular-nums">
        <div className="flex justify-between gap-4"><dt>Pieces subtotal</dt><dd>{money(totals.subtotalCents)}</dd></div>
        {args.tradeDiscountApplied && <div className="flex justify-between gap-4"><dt>Trade discount{args.tierLabel ? ` · ${args.tierLabel}` : ""}</dt><dd>−{money(totals.discountCents)}</dd></div>}
        {args.extras?.map((extra, index) => <div key={index} className="flex justify-between gap-4 text-muted-foreground"><dt>{extra.label}</dt><dd>{money(extra.amountCents)}</dd></div>)}
        {totals.insuranceCents > 0 && <div className="flex justify-between gap-4"><dt>Insurance</dt><dd>{money(totals.insuranceCents)}</dd></div>}
        {totals.shippingCents > 0 && <div className="flex justify-between gap-4"><dt>{args.shippingModeLabel || "Shipping"}</dt><dd>{money(totals.shippingCents)}</dd></div>}
        {args.gstEnabled && <div className="flex justify-between gap-4"><dt>Tax ({args.gstRate}%)</dt><dd>{money(totals.taxCents)}</dd></div>}
        <div className="flex justify-between gap-4 border-t border-border pt-3 text-sm font-medium"><dt>{ceiling ? "Client ceiling" : "Quote total"}</dt><dd>{money(ceiling?.targetCeilingCents ?? totals.grandTotalCents)}</dd></div>
      </dl>
    </section>
  );
}