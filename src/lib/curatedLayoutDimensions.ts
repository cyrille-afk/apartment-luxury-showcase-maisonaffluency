import type { ProductDimensions } from "./productDimensions";
import { resolveDimensions } from "./productDimensions";

export type MetreDimensions = { w: number; d: number; h: number };
type Source = { dimensionsCubic?: Partial<MetreDimensions> | null; dimensions_cubic?: Partial<MetreDimensions> | null; dimensions?: string | null; width_mm?: number | null; depth_mm?: number | null; height_mm?: number | null; role?: string; name?: string; sku?: string | null };

/** Magnitude inference is only for unlabelled catalogue values, not explicit units. */
export function dimensionToMetres(value: number): number {
  return value > 300 ? value / 1000 : value > 10 ? value / 100 : value;
}

export function normalizeMetreDimensions(value?: Partial<MetreDimensions> | null): MetreDimensions | null {
  if (!value || ![value.w, value.d, value.h].every((n) => typeof n === "number" && Number.isFinite(n) && n > 0)) return null;
  return { w: dimensionToMetres(Number(value.w)), d: dimensionToMetres(Number(value.d)), h: dimensionToMetres(Number(value.h)) };
}

export function curatedDimensions(source: Source): MetreDimensions {
  const cubic = normalizeMetreDimensions(source.dimensionsCubic ?? source.dimensions_cubic);
  if (cubic) return cubic;
  const raw = source.dimensions ?? "";
  const unit = raw.match(/\b(mm|cm|m)\b/i)?.[1]?.toLowerCase();
  const axes = [raw.match(/\b(?:W|Width)\s*[:=]?\s*([\d.]+)/i)?.[1], raw.match(/\b(?:D|Depth)\s*[:=]?\s*([\d.]+)/i)?.[1], raw.match(/\b(?:H|Height)\s*[:=]?\s*([\d.]+)/i)?.[1]];
  const triple = raw.match(/^\s*([\d.]+)\s*[×xX]\s*([\d.]+)\s*[×xX]\s*([\d.]+)/);
  const values = axes.every(Boolean) ? axes.map(Number) : triple ? triple.slice(1, 4).map(Number) : null;
  const mm = source.width_mm && source.depth_mm && source.height_mm ? resolveDimensions(source) : null;
  if (mm) return millimetresToMetres(mm);
  if (values?.every((n) => Number.isFinite(n) && n > 0)) {
    const convert = (n: number) => unit === "mm" ? n / 1000 : unit === "cm" ? n / 100 : unit === "m" ? n : dimensionToMetres(n);
    return { w: convert(values[0]), d: convert(values[1]), h: convert(values[2]) };
  }
  const parsed = resolveDimensions(source);
  if (parsed) return millimetresToMetres(parsed);
  const name = `${source.name ?? ""} ${source.sku ?? ""}`;
  if (/console|sideboard|credenza/i.test(name)) return { w: 1.5, d: 0.4, h: 0.8 };
  if (/stool|ottoman/i.test(name)) return { w: 0.45, d: 0.45, h: 0.45 };
  const sizes: Record<string, MetreDimensions> = { anchor: { w: 2.4, d: 1, h: 0.8 }, table: { w: 1.2, d: 0.7, h: 0.4 }, seat: { w: 0.8, d: 0.8, h: 0.8 }, light: { w: 0.5, d: 0.5, h: 1.6 } };
  return sizes[source.role ?? ""] ?? { w: 0.5, d: 0.5, h: 0.5 };
}

const millimetresToMetres = (d: ProductDimensions): MetreDimensions => ({ w: d.w / 1000, d: d.d / 1000, h: d.h / 1000 });