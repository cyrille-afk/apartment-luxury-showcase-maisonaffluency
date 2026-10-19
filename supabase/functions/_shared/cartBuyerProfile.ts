/** Later pings without a profile must not erase a captured classification. */
export function cartBuyerProfileFields(profile: unknown): { buyer_profile?: "private" | "designer" } {
  return profile === "private" || profile === "designer" ? { buyer_profile: profile } : {};
}