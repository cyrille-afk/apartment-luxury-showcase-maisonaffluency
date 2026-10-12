/**
 * A visitor's remembered variant choice (sessionStorage) can outlive the
 * product data it was made against — e.g. after a Composition or Density
 * wording edit. Restoring a value that no longer exists makes every size look
 * incompatible (all options crossed out), so each remembered axis value is
 * kept only if the current variants still offer it.
 */
export type StoredVariantSelection = {
  base?: string | null;
  top?: string | null;
  dualSize?: string | null;
  mat?: string | null;
  size?: string | null;
};

type VariantRow = { label?: string | null; base?: string | null; top?: string | null };

const has = (rows: VariantRow[], field: keyof VariantRow, value: string | null | undefined) =>
  !!value && rows.some((r) => ((r?.[field] as string | null | undefined) || "").trim() === value);

export function sanitizeStoredSelection(
  stored: StoredVariantSelection | null | undefined,
  variants: VariantRow[] | null | undefined,
  singleAxis?: { sizes: string[]; materials: string[]; split: boolean },
): Required<StoredVariantSelection> {
  const rows = Array.isArray(variants) ? variants : [];
  const s = stored || {};
  const split = !!singleAxis?.split;
  return {
    base: has(rows, "base", s.base) ? s.base! : null,
    top: has(rows, "top", s.top) ? s.top! : null,
    dualSize: has(rows, "label", s.dualSize) ? s.dualSize! : null,
    mat: split && s.mat && singleAxis!.materials.includes(s.mat) ? s.mat : null,
    size: !s.size
      ? null
      : split
      ? singleAxis!.sizes.includes(s.size) ? s.size : null
      : has(rows, "label", s.size) ? s.size : null,
  };
}
