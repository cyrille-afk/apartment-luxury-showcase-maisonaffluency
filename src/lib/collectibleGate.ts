// Trade-only visibility for Collectible Design.
// While Collectible Design is in a soft-launch phase, only authenticated trade
// users can view the /collectibles index, individual collectible designer
// profiles, and their product pages. Public visitors are redirected to the
// trade login.
//
// Source of truth: `collectible_roster.gated` in the database.
import { useCollectibleRoster } from "@/lib/collectibleRoster";

/**
 * Returns a checker for gated collectible slugs, or null while the roster
 * is still loading (callers should wait rather than render gated content).
 */
export function useCollectibleSlugGate(): ((slug: string | null | undefined) => boolean) | null {
  const roster = useCollectibleRoster();
  if (!roster) return null;
  return (slug) => !!slug && roster.gated.has(slug);
}

/** Path to redirect public visitors to when hitting a gated collectible route. */
export function collectibleGateRedirect(from: string): string {
  const params = new URLSearchParams({ redirect: from });
  return `/trade/login?${params.toString()}`;
}
