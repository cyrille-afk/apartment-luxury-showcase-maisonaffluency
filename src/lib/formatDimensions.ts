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
  return `${(n / 2.54).toFixed(1)}`;
};

const CM_RE = /(?:\b|\d)cm\b/i;
const CM_RE_G = /\s*cm\b/gi;

const stripVariantPrefix = (part: string): string => {
  const cmIdx = part.search(CM_RE);
  if (cmIdx < 0) return part;

  const beforeCm = part.slice(0, cmIdx);
  const pipeIdx = beforeCm.lastIndexOf("|");
  if (pipeIdx >= 0) return part.slice(pipeIdx + 1).trim();

  const colonIdx = beforeCm.lastIndexOf(":");
  if (colonIdx >= 0) return part.slice(colonIdx + 1).trim();

  return part;
};

const toImperialLine = (line: string): string | null => {
  if (!CM_RE.test(line)) return null;
  const converted = line
    .split(/(\s+[·•]\s+|\s*;\s*)/)
    .map((part) => {
      if (!CM_RE.test(part)) return part;
      // Preserve parenthetical suffixes verbatim (e.g. "(2 Seater)") — their
      // digits are labels, not dimensions, and must not be cm→in converted.
      const parens: string[] = [];
      const masked = part.replace(/\([^)]*\)/g, (m) => {
        parens.push(m);
        return `\u0000${parens.length - 1}\u0000`;
      });
      let stripped = stripVariantPrefix(masked)
        .replace(CM_RE_G, "")
        .replace(/\d+(?:[.,]\d+)?/g, cmToInches)
        .replace(/\s+/g, " ")
        .trim();
      stripped = stripped.replace(/\u0000(\d+)\u0000/g, (_, i) => ` ${parens[Number(i)]}`).replace(/\s+/g, " ").trim();
      if (!stripped) return stripped;
      // Place " in" before any trailing parenthetical label.
      const tail = stripped.match(/\s*(\([^)]*\)\s*)+$/);
      if (tail) {
        const head = stripped.slice(0, stripped.length - tail[0].length).trim();
        return `${head} in ${tail[0].trim()}`;
      }
      return `${stripped} in`;
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
      if (!imp) return t;
      // Strip any leading label words shared with the metric line so the
      // imperial parenthetical doesn't repeat "Sofa Double Depth" etc.
      const metricWords = t.split(/\s+/);
      const impWords = imp.split(/\s+/);
      let i = 0;
      while (
        i < metricWords.length &&
        i < impWords.length &&
        metricWords[i] === impWords[i] &&
        !/[\d"Ø⌀×x]/.test(impWords[i])
      ) {
        i++;
      }
      let trimmedImp = impWords.slice(i).join(" ").trim();

      // Strip trailing prose shared with the metric line so text like
      // " - Stem height TBC on order" doesn't duplicate after the "|".
      const impArr = trimmedImp.split(/\s+/);
      const metricArr = t.split(/\s+/);
      let impEnd = impArr.length;
      while (impEnd > 0 && impArr[impEnd - 1] === "in") impEnd--;
      let k = 0;
      while (
        k < impEnd &&
        k < metricArr.length &&
        impArr[impEnd - 1 - k] === metricArr[metricArr.length - 1 - k]
      ) {
        k++;
      }
      if (k > 0) {
        const minKeep = impArr.findIndex((w) => /[\d"Ø⌀×x]/.test(w));
        const keepCount = Math.max(minKeep >= 0 ? minKeep + 1 : 1, impEnd - k);
        const stripped = impArr.slice(0, keepCount);
        while (
          stripped.length > 0 &&
          /^[-–—,;:.]$/.test(stripped[stripped.length - 1])
        ) {
          stripped.pop();
        }
        trimmedImp = stripped.concat("in").join(" ").trim();
      }

      return trimmedImp ? `${t} | ${trimmedImp}` : t;
    })
    .join("\n");
};


