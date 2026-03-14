/**
 * Reusable skeleton primitives for the trade portal.
 * All use Tailwind's animate-pulse and semantic design tokens.
 */

const Bone = ({ className = "" }: { className?: string }) => (
  <div className={`rounded bg-muted animate-pulse ${className}`} />
);

/** Mimics a quote list card (TradeQuotes) */
export const QuoteCardSkeleton = () => (
  <div className="border border-border rounded-lg p-4">
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-3">
          <Bone className="h-4 w-24" />
          <Bone className="h-4 w-16 rounded-full" />
        </div>
        <Bone className="h-3 w-40" />
      </div>
      <Bone className="h-4 w-4 rounded shrink-0" />
    </div>
  </div>
);

/** Mimics a product card in grid view (TradeShowroom / TradeGallery) */
export const ProductCardSkeleton = () => (
  <div className="border border-border rounded-lg overflow-hidden">
    <Bone className="aspect-square w-full rounded-none" />
    <div className="p-3 space-y-2">
      <Bone className="h-3 w-3/4" />
      <Bone className="h-2.5 w-1/2" />
      <Bone className="h-2.5 w-1/3" />
    </div>
  </div>
);

/** Mimics a document card with thumbnail (TradeDocuments) */
export const DocumentCardSkeleton = () => (
  <div className="border border-border rounded-lg overflow-hidden">
    <Bone className="aspect-[3/4] w-full rounded-none" />
    <div className="p-3 space-y-1.5">
      <Bone className="h-3.5 w-4/5" />
      <Bone className="h-2.5 w-2/5" />
    </div>
  </div>
);

/** Mimics an admin application card (TradeAdmin) */
export const ApplicationCardSkeleton = () => (
  <div className="border border-border rounded-lg p-5 space-y-3">
    <div className="flex items-center gap-3">
      <Bone className="h-5 w-32" />
      <Bone className="h-4 w-16 rounded-full" />
    </div>
    <Bone className="h-3 w-56" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <Bone className="h-3 w-full" />
      <Bone className="h-3 w-full" />
      <Bone className="h-3 w-full" />
      <Bone className="h-3 w-full" />
    </div>
  </div>
);

/** Mimics a recent activity row (TradeDashboard) */
export const ActivityRowSkeleton = () => (
  <div className="flex items-center gap-3 px-4 py-3">
    <Bone className="h-4 w-4 rounded shrink-0" />
    <div className="flex-1 min-w-0 space-y-1.5">
      <Bone className="h-3.5 w-48" />
      <Bone className="h-2.5 w-28" />
    </div>
    <Bone className="h-2.5 w-12 shrink-0" />
  </div>
);

/** Mimics a brand folder tile (TradeDashboard) */
export const BrandFolderSkeleton = () => (
  <div className="flex flex-col items-center gap-2 border border-border rounded-lg p-4">
    <Bone className="h-8 w-8 rounded" />
    <Bone className="h-3 w-16" />
    <Bone className="h-2.5 w-10" />
  </div>
);

/** Mimics a quote line item row (QuoteDetail) */
export const QuoteItemSkeleton = () => (
  <div className="py-3 md:py-4 flex gap-3 md:gap-4">
    <Bone className="w-14 h-14 md:w-20 md:h-20 rounded shrink-0" />
    <div className="flex-1 space-y-2">
      <Bone className="h-3.5 w-40" />
      <Bone className="h-2.5 w-24" />
      <Bone className="h-2.5 w-32" />
    </div>
  </div>
);

/** Mimics a drawer item row (QuoteDrawer) */
export const DrawerItemSkeleton = () => (
  <div className="flex items-center gap-3 p-2 rounded-lg border border-border">
    <Bone className="w-12 h-12 rounded shrink-0" />
    <div className="flex-1 min-w-0 space-y-1.5">
      <Bone className="h-2 w-16" />
      <Bone className="h-3 w-28" />
      <Bone className="h-2 w-20" />
    </div>
  </div>
);
