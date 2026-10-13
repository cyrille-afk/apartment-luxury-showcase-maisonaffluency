import { formatDimensions, resolveDimensions } from "./productDimensions";

type DimensionRecord = Parameters<typeof resolveDimensions>[0];

/** Preserve recorded dimensions; fall back to the linked pick's size metadata. */
export function visualiserDimensions(product: DimensionRecord, pick?: DimensionRecord): string | null {
  return formatDimensions(resolveDimensions(product) ?? resolveDimensions(pick));
}