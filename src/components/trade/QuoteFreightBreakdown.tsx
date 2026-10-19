import type { QuoteFreightAudit } from "@/lib/quoteFreightBreakdown";

export default function QuoteFreightBreakdown({ audit, loading }: { audit: QuoteFreightAudit; loading: boolean }) {
  return (
    <section aria-label="Freight breakdown" className="border-t border-border pt-4 font-body text-xs text-foreground">
      <h3 className="font-display text-sm mb-2">Freight breakdown</h3>
      <p>Destination used: <span className="font-medium">{audit.destination}</span></p>
      <p className="text-muted-foreground mt-1">Destination source: {audit.addressSource}</p>
      {loading ? <p role="status" className="mt-3 text-muted-foreground">Calculating freight…</p> : <>
        {audit.shipments.map((shipment, index) => (
          <div key={`${shipment.route}-${index}`} className="mt-3 space-y-1 min-w-0 break-words">
            <p className="font-medium">{shipment.route}</p>
            {shipment.lines.map((line) => <p key={line} className="text-muted-foreground leading-relaxed">{line}</p>)}
          </div>
        ))}
        <div className="flex flex-wrap justify-between gap-2 border-t border-border mt-3 pt-2 font-medium">
          <span>Total shipping estimate (before import tax)</span><span>{audit.total}</span>
        </div>
      </>}
    </section>
  );
}