// Trade-only visibility for Collectible Design.
// While Collectible Design is in a soft-launch phase, only authenticated trade
// users can view the /collectibles index, individual collectible designer
// profiles, and their product pages. Public visitors are redirected to the
// trade login.
//
// Source of truth: the hardcoded `collectibleDesigners` array in
// `src/components/Collectibles.tsx`. If a slug appears there, it's gated.
import { collectibleDesigners } from "@/components/Collectibles";

/** Collectible designer slugs that are publicly accessible (exceptions to the gate). */
export const PUBLIC_COLLECTIBLE_SLUGS: ReadonlySet<string> = new Set([
  "pierre-bonnefille",
]);

export const COLLECTIBLE_SLUGS: ReadonlySet<string> = new Set(
  collectibleDesigners
    .map((d) => (d as { id?: string })?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .filter((id) => !PUBLIC_COLLECTIBLE_SLUGS.has(id)),
);

export function isCollectibleSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return COLLECTIBLE_SLUGS.has(slug);
}

/** Path to redirect public visitors to when hitting a gated collectible route. */
export function collectibleGateRedirect(from: string): string {
  const params = new URLSearchParams({ redirect: from });
  return `/trade/login?${params.toString()}`;
}
