/**
 * ProductDetailSkeleton — layout-matching placeholder for curator pick
 * detail pages / modals. Shown when prefetch misses so the shell renders
 * immediately instead of a bare spinner.
 */
interface ProductDetailSkeletonProps {
  /** Compact (lightbox modal) vs full page. */
  variant?: "page" | "modal";
  /** Optional pre-known hero image (e.g. from the grid card) to avoid a blank tile. */
  heroImage?: string | null;
}

const shimmer =
  "relative overflow-hidden bg-muted/40 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent";

const Line = ({ w = "w-full", h = "h-3" }: { w?: string; h?: string }) => (
  <div className={`${shimmer} ${w} ${h} rounded-sm`} />
);

const ProductDetailSkeleton = ({ variant = "page", heroImage }: ProductDetailSkeletonProps) => {
  const isModal = variant === "modal";

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading product details"
      className={
        isModal
          ? "w-full max-w-6xl mx-auto px-4 md:px-8 py-6"
          : "w-full max-w-7xl mx-auto px-4 md:px-8 pt-8 md:pt-12 pb-16"
      }
    >
      <style>{`@keyframes shimmer { 100% { transform: translateX(100%); } }`}</style>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
        {/* Image column */}
        <div className="space-y-3">
          <div className={`${shimmer} aspect-square w-full rounded-sm`}>
            {heroImage && (
              <img
                src={heroImage}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover opacity-60"
              />
            )}
          </div>
          {!isModal && (
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`${shimmer} aspect-square rounded-sm`} />
              ))}
            </div>
          )}
        </div>

        {/* Info column */}
        <div className="space-y-6">
          <div className="space-y-3">
            <Line w="w-1/3" h="h-3" />
            <Line w="w-4/5" h="h-7" />
            <Line w="w-3/5" h="h-4" />
          </div>

          <div className="space-y-2 pt-2">
            <Line w="w-full" />
            <Line w="w-11/12" />
            <Line w="w-10/12" />
            <Line w="w-9/12" />
          </div>

          <div className="space-y-2 pt-2">
            <Line w="w-1/4" h="h-2" />
            <Line w="w-2/3" />
            <Line w="w-1/2" />
          </div>

          <div className="flex gap-3 pt-4">
            <div className={`${shimmer} h-11 w-40 rounded-full`} />
            <div className={`${shimmer} h-11 w-11 rounded-full`} />
          </div>
        </div>
      </div>

      <span className="sr-only">Loading product details…</span>
    </div>
  );
};

export default ProductDetailSkeleton;
