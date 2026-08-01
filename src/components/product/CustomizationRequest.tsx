import { Wand2 } from "lucide-react";

interface Props {
  productId: string;
  productTitle: string;
  designerDisplay: string;
  /** True only for a vetted, approved trade member. Routes the request to Felix. */
  tradeApproved: boolean;
  onRequestQuote: () => void;
}

/**
 * "Request Customization" affordance shown below the product details.
 *
 * - Public guests: opens the standard "Request A Quote Or Customisation" form
 *   (QuoteRequestDialog) so the layout matches every other quote entry point.
 * - Approved trade members: skips the form and seeds the Felix composer with a
 *   structural customization brief for the piece in view.
 */
export default function CustomizationRequest({
  productId,
  productTitle,
  designerDisplay,
  tradeApproved,
  onRequestQuote,
}: Props) {

  const askFelix = () => {
    window.dispatchEvent(
      new CustomEvent("concierge:stage", {
        detail: {
          openPanel: true,
          prefill: `Bespoke customization request — ${productTitle} by ${designerDisplay}.\n\nFelix, act as my curatorial guide on a made-to-order variation of this piece: bespoke dimensions, alternative finishes/materials, and any structural adaptation. Ask me what I need, then draft the atelier request with feasibility and indicative lead time.`,
        },
      })
    );
  };

  const handleClick = () => {
    if (tradeApproved) {
      askFelix();
      return;
    }
    onRequestQuote();
  };

  return (
    <div className="mt-4 border-t border-border/60 pt-4">
      {/* Crawlable statement — plain HTML so search engines index that this
          piece can be made to bespoke dimensions and finishes. */}
      <p className="font-body text-xs md:text-sm text-muted-foreground leading-relaxed">
        Bespoke dimensions and finishes available upon request
      </p>
      <button
        type="button"
        onClick={handleClick}
        className="mt-2 inline-flex items-center gap-2 font-body text-[11px] md:text-xs uppercase tracking-[0.14em] text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground transition-colors"
      >
        <Wand2 size={13} strokeWidth={1.5} />
        Request Customization
      </button>
    </div>
  );
}
