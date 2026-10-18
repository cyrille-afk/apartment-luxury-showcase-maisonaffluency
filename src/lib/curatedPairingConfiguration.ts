import type { PublicRrpRow } from "@/hooks/usePublicRrp";

export type PairingVariant = { base?: string | null; top?: string | null; label?: string | null; price_cents?: number | null };
export type PairingSelection = { base: string | null; top: string | null; label: string | null };
export const pairingAxes = ["base", "top", "label"] as const;

export function pairingAxisOptions(rows: PairingVariant[], axis: keyof PairingSelection) {
  return Array.from(new Set(rows.map((row) => row[axis]?.trim()).filter((value): value is string => Boolean(value))));
}

export function pairingOptionAvailable(rows: PairingVariant[], selection: PairingSelection, axis: keyof PairingSelection, value: string) {
  return rows.some((row) => pairingAxes.every((key) => key === axis ? row[key] === value : !selection[key] || row[key] === selection[key]));
}

export function pairingSelectionComplete(rows: PairingVariant[], selection: PairingSelection) {
  return pairingAxes.every((axis) => !pairingAxisOptions(rows, axis).length || Boolean(selection[axis])) &&
    (!rows.length || rows.some((row) => pairingAxes.every((axis) => !selection[axis] || row[axis] === selection[axis])));
}

/** Never use a cheapest/base price for a selected, unpriced matrix configuration. */
export function pairingSelectionPrice(row: PublicRrpRow | null | undefined, selection: PairingSelection): number | null {
  if (!row) return null;
  const variants = row.rrp_size_variants || [];
  if (!variants.length) return row.rrp_price_cents && row.rrp_price_cents > 0 ? row.rrp_price_cents : null;
  if (!pairingSelectionComplete(variants, selection)) return null;
  const match = variants.find((variant) => pairingAxes.every((axis) => !selection[axis] || variant[axis] === selection[axis]));
  return match?.price_cents && match.price_cents > 0 ? match.price_cents : null;
}