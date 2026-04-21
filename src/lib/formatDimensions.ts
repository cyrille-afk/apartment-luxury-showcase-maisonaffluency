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

  // Detect "label: value" variant pattern (e.g. "Angelo M/R 130: Ø 130 × H 75 cm, Angelo M/R 160: ...",
  // or "Angelo M/O 210: L 210 × H 75 cm / Angelo M/O 250: ...").
  // Split on `, ` OR ` / ` when followed by another "label:" cluster.
  // Lookahead allows `/` inside the label (e.g. "M/R 160") but stops at the next `:` or `,`.
  const variantSplit = trimmed.split(/\s*(?:,|\/)\s+(?=[^,:]*?:\s)/);
  if (variantSplit.length > 1) return variantSplit.join("\n");

  return trimmed;
};
