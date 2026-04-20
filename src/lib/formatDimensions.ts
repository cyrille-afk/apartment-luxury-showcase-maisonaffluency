/**
 * Normalize a dimensions string so each dimension/variant displays on its own line.
 *
 * Rule: when a dimensions field contains multiple entries (separated by commas
 * or explicit newlines), render each on a separate line. We only split on commas
 * that look like variant separators (i.e. when at least one comma is followed
 * by a label-style token such as "Name: ..." or another dimension cluster),
 * to avoid breaking single dimensions like "120 × 45 × 60 cm".
 */
export const formatDimensionsMultiline = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const trimmed = raw.trim();
  // Already has explicit newlines — respect them.
  if (trimmed.includes("\n")) return trimmed;

  // Detect "label: value" variant pattern (e.g. "VHS/M 120-45/60 glass: 120 × 45 × 45/60 cm").
  // If multiple ", <label>: " separators exist, split on them.
  const variantSplit = trimmed.split(/,\s*(?=[^,]*?:\s)/);
  if (variantSplit.length > 1) return variantSplit.join("\n");

  return trimmed;
};
