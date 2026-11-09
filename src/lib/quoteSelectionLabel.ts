type SelectedFinish = { label: string; name: string };

/** Persist the same concrete finish choices shown in the product workspace. */
export function quoteSelectionLabel(
  finishes: SelectedFinish[] | null | undefined,
  fallback: string | null,
  size: string | null = null,
): string | null {
  const selected = (finishes || [])
    .filter((finish) => finish.name.trim())
    .map((finish) => `${finish.label.trim()}: ${finish.name.trim()}`);
  if (!selected.length) return fallback;
  if (size?.trim()) selected.push(size.trim());
  return selected.join(" · ");
}