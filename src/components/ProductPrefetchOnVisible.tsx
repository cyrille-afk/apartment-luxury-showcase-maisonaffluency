import { usePrefetchProductOnVisible } from "@/hooks/usePrefetchProductOnVisible";

interface ProductPrefetchOnVisibleProps {
  designerSlug?: string;
  productSlug?: string;
  rootMargin?: string;
}

/**
 * Invisible sentinel: when the surrounding card scrolls near the viewport,
 * the public product page data + route chunk are prefetched during idle time.
 */
const ProductPrefetchOnVisible = ({
  designerSlug,
  productSlug,
  rootMargin,
}: ProductPrefetchOnVisibleProps) => {
  const ref = usePrefetchProductOnVisible(designerSlug, productSlug, { rootMargin });
  return <span ref={ref} aria-hidden="true" className="block h-0 w-0 overflow-hidden" />;
};

export default ProductPrefetchOnVisible;
