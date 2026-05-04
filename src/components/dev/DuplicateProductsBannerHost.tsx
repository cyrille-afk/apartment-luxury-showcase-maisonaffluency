import { useTradeProducts } from "@/hooks/useTradeProducts";
import DuplicateProductsBanner from "./DuplicateProductsBanner";

/**
 * Dev-only host: mounts the duplicate-products inspector pill globally so it
 * is reachable from any page during development. Calls `useTradeProducts`
 * (which is already cached via React Query) so the merged catalog is in
 * memory and the duplicate detection runs on every load. Production builds
 * skip mounting this entirely.
 */
export default function DuplicateProductsBannerHost() {
  const { duplicateGroups } = useTradeProducts();
  return <DuplicateProductsBanner groups={duplicateGroups} />;
}
