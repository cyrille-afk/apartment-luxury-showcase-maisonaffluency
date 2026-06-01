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

const cmToInches = (value: string): string => {
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n)) return value;
  return `${(n / 2.54).toFixed(1)}\"`;
};

const toImperialLine = (line: string): string | null => {
  if (!/\bcm\b/i.test(line)) return null;
  const converted = line
    .split(/(\s+[·•]\s+|\s*;\s*)/)
    .map((part) => {
      if (!/\bcm\b/i.test(part)) return part;
      return part
        .replace(/\s*cm\b/gi, "")
        .replace(/\d+(?:[.,]\d+)?/g, cmToInches);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return converted && converted !== line ? converted : null;
};

export const formatImperialDimensions = (raw: string | null | undefined): string | null => {
  const metric = formatDimensionsMultiline(raw);
  if (!metric) return null;
  const converted = metric
    .split("\n")
    .map((line) => toImperialLine(line.trim()))
    .filter(Boolean) as string[];
  return converted.length ? converted.join("\n") : null;
};

/**
 * For multi-line dimension text, append the imperial conversion inline to
 * each line, e.g. "Ø 80 × H 60 cm  (Ø 31.5" × H 23.6")".
 * Lines without convertible units are returned unchanged.
 */
export const withImperialPerLine = (raw: string | null | undefined): string => {
  const metric = formatDimensionsMultiline(raw);
  if (!metric) return "";
  return metric
    .split("\n")
    .map((line) => {
      const t = line.trim();
      const imp = toImperialLine(t);
      return imp ? `${t}  (${imp})` : t;
    })
    .join("\n");
};

