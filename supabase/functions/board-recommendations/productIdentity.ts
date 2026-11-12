interface CatalogueIdentity {
  id: string;
  source: 'curator' | 'trade';
  source_pick_id?: string | null;
}

export function productIdentity(product: CatalogueIdentity): string {
  return product.source === 'curator' || product.source_pick_id
    ? `pick:${product.source === 'curator' ? product.id : product.source_pick_id}`
    : `trade:${product.id}`;
}

/** Keep catalogue metadata when both representations are available. */
export function groupCatalogueProducts<T extends CatalogueIdentity>(products: T[], excluded: Set<string> = new Set()): T[] {
  const grouped = new Map<string, T>();
  for (const product of products) {
    const key = productIdentity(product);
    if (excluded.has(key)) continue;
    const existing = grouped.get(key);
    if (!existing || product.source === 'curator') grouped.set(key, product);
  }
  return [...grouped.values()];
}