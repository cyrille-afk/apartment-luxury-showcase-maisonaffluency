import { FileText, ExternalLink } from "lucide-react";

interface QuoteProduct {
  product_name: string;
  brand_name: string;
  price_label?: string | null;
}

interface Props {
  optionLabel: string;
  quoteRef: string;
  products: QuoteProduct[];
  quoteId?: string;
}

/** Quote summary slide shown after each furnishing option in the presentation viewer */
export default function PresentationQuoteSummary({ optionLabel, quoteRef, products, quoteId }: Props) {
  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-10">
      <div className="border border-border rounded-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/50 mb-4">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Quote Summary</span>
          </div>
          <h3 className="font-display text-xl text-foreground">{optionLabel}</h3>
          <p className="font-body text-xs text-muted-foreground mt-1">Reference: {quoteRef}</p>
        </div>

        {/* Product list */}
        <div className="divide-y divide-border mb-8">
          {products.map((p, i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div>
                <p className="font-body text-sm text-foreground">{p.product_name}</p>
                <p className="font-body text-[10px] text-muted-foreground">{p.brand_name}</p>
              </div>
              <p className="font-body text-sm text-foreground/70">
                {p.price_label || <span className="italic text-muted-foreground">Price on request</span>}
              </p>
            </div>
          ))}
        </div>

        {/* Note */}
        <div className="bg-muted/30 rounded-lg p-5 text-center space-y-2">
          <p className="font-body text-sm text-foreground">
            This quote is available for review in your <strong>Quote Builder</strong>.
          </p>
          <p className="font-body text-xs text-muted-foreground">
            Payment terms: 60% deposit upon confirmation · 40% balance before delivery.
          </p>
          {quoteId && (
            <a
              href={`/trade/quotes`}
              className="inline-flex items-center gap-1.5 font-body text-xs text-primary hover:underline mt-2"
            >
              <ExternalLink className="w-3 h-3" />
              Open Quote Builder
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
