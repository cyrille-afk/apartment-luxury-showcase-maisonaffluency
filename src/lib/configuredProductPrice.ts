/** Fabric surcharges are added after the member benefit, just like quote lines. */
export function configuredProductPrice(baseRrpCents: number, fabricUpchargeCents: number, discount: number) {
  return {
    retailCents: baseRrpCents + fabricUpchargeCents,
    netCents: Math.round(baseRrpCents * (1 - discount)) + fabricUpchargeCents,
  };
}