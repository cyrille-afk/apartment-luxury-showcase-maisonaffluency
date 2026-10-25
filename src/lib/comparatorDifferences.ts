import type { TradeProduct } from "./tradeProducts";

const specificationKeys = new Set(["brand_name", "category", "dimensions", "materials", "lead_time"]);

function normalizedValue(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();
  if (key === "materials") return [...new Set(value.split(/\r?\n|\s*[•·;]\s*/).map(normalize).filter(Boolean))].sort().join("|");
  return normalize(value);
}

export function differingSpecificationCells(products: (TradeProduct | null)[], key: string): boolean[] {
  const values = products.map(product => product ? normalizedValue(product[key as keyof TradeProduct], key) : "");
  const differs = specificationKeys.has(key) && new Set(values.filter(Boolean)).size > 1;
  return values.map(value => differs && !!value);
}