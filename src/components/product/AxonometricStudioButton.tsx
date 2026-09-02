import { Link } from "react-router-dom";
import { Box } from "lucide-react";
import { useTradeProductPricing } from "@/hooks/useTradeProductPricing";
import { cn } from "@/lib/utils";

/**
 * Standalone "Open Axonometric Studio" entry for verified trade users.
 *
 * Lives directly beneath the finish selectors — detached from the purchase /
 * co-pilot action box — and reads as a design & visualisation tool available
 * to every trade member. When the product's trade twin is resolved, it is
 * preloaded into the visualisation brief via the `favorites` query param.
 */
export default function AxonometricStudioButton({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  const { data: pricing } = useTradeProductPricing(productId, true);
  const href = pricing?.id
    ? `/trade/axonometric-requests?favorites=${pricing.id}`
    : "/trade/axonometric-requests";

  return (
    <Link
      to={href}
      className={cn(
        "inline-flex h-12 w-full items-center justify-center gap-2 rounded-none border border-foreground/40 bg-background text-foreground font-body text-xs uppercase tracking-widest transition-all hover:bg-muted/60",
        className
      )}
    >
      <Box className="h-3.5 w-3.5" strokeWidth={1.5} />
      Open Axonometric Studio
    </Link>
  );
}
