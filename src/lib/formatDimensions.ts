/**
 * Normalize a dimensions string so each dimension/variant displays on its own line.
 *
 * Rule: when a dimensions field contains multiple entries (separated by commas
 * or explicit newlines), render each on a separate line. We only split on commas
 * that look like variant separators (i.e. when at least one comma is followed
 * by a label-style token such as "Name: ..." or another dimension cluster),
 * to avoid breaking single dimensions like "120 × 45 × 60 cm".
 *
 * Additional rule (site-wide): a label of the form `<qualifier><separator><dimensions>`
 * — e.g. "10 Lights - Dia 100 x H 100 cm" or "Angelo M/R 130: Ø 130 × H 75 cm" —
 * is reordered so the dimensions come first and the qualifier is appended after
 * an em-dash, giving "Dia 100 x H 100 cm — 10 Lights". The imperial converter
 * strips the trailing qualifier before converting and re-appends it at the very
 * end so the final render reads:
 *   "Dia 100 x H 100 cm | 39.4 x H 39.4 in — 10 Lights"
 */

const DIM_UNIT_RE = /\b(?:cm|mm|in|inches?|")\b/i;
// Axis-labelled measurements may share a unit at the end of the whole row.
const DIM_AXIS_RE = /(?:\b(?:W|D|H|L|SH|AH|AR|Dia)\.?\s*|[Ø⌀]\s*)\d/i;

/**
 * If the line reads "<qualifier> - <dimensions>" (or ":" / en/em-dash separators)
 * where only the right side carries units, reorder to "<dimensions> — <qualifier>".
 * Idempotent — lines already in canonical form pass through unchanged.
 */
const reorderQualifierBeforeDims = (line: string): string => {
  const t = line.trim();
  if (!t) return t;
  // Skip if already in canonical "<dims> — <qualifier>" shape.
  if (/\s—\s/.test(t)) return t;
  const m = t.match(/^(.+?)\s*[-–—:]\s+(.+)$/);
  if (!m) return t;
  const left = m[1].trim();
  const right = m[2].trim();
  const leftHasDim = DIM_UNIT_RE.test(left) || DIM_AXIS_RE.test(left);
  const rightHasDim = DIM_UNIT_RE.test(right);
  if (leftHasDim || !rightHasDim) return t;
  return `${right} — ${left}`;
};

/** Split a canonical line into `{ dim, qual }`; `qual` is empty when absent. */
export const splitDimensionQualifier = (line: string): { dim: string; qual: string } => {
  const idx = line.lastIndexOf(" — ");
  if (idx < 0) return { dim: line, qual: "" };
  const dim = line.slice(0, idx);
  const qual = line.slice(idx + 3);
  // The trailing chunk is only treated as a qualifier when it contains NO
  // dimension unit (otherwise " — " is just prose inside the dims themselves).
  if (DIM_UNIT_RE.test(qual) || DIM_AXIS_RE.test(qual)) return { dim: line, qual: "" };
  return { dim, qual };
};

export const formatDimensionsMultiline = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const trimmed = raw.trim();
  const applyReorder = (s: string) =>
    s
      .split("\n")
      .map((ln) => reorderQualifierBeforeDims(ln))
      .join("\n");

  // Already has explicit newlines — respect them.
  if (trimmed.includes("\n")) return applyReorder(trimmed);

  // Detect "label: value" variant pattern (e.g. "Angelo M/R 130: Ø 130 × H 75 cm, Angelo M/R 160: ...",
  // or "Angelo M/O 210: L 210 × H 75 cm / Angelo M/O 250: ...").
  // Split on `, ` OR ` / ` when followed by another "label:" cluster.
  // Lookahead allows `/` inside the label (e.g. "M/R 160") but stops at the next `:` or `,`.
  const variantSplit = trimmed.split(/\s*(?:,|\/)\s+(?=[^,:]*?:\s)/);
  if (variantSplit.length > 1) return applyReorder(variantSplit.join("\n"));

  return applyReorder(trimmed);
};


const CM_RE = /(?:\b|\d)(?:[cC][mM]|[mM][mM]|m)\b/;
const LENGTH_UNIT_RE = /(?<![a-zA-Z])(?:[cC][mM]|[mM][mM]|m)\b/g;

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

export const toImperialLine = (line: string): string | null => {
  if (!CM_RE.test(line)) return null;
  const qualified = splitDimensionQualifier(line);
  if (qualified.qual) {
    const imperial = toImperialLine(qualified.dim);
    return imperial ? `${imperial} — ${qualified.qual}` : null;
  }
  // Existing supplier inch lines are not metric input. Regenerate from the
  // recorded metric measurements instead of converting both sets of numbers.
  const metricOnly = line.replace(/\s*\|\s*[^|\n]*(?:\bin\b|\binches\b|″|”)[^|\n]*/gi, "");
  const converted = metricOnly
    .split(/(\s+[·•]\s+|\s*;\s*)/)
    .map((part) => {
      if (!CM_RE.test(part)) return part;
      const parens: string[] = [];
      let parentMeasurements = 0;
      const masked = part.replace(/\([^)]*\)/g, (m) => {
        // Convert actual measurements inside parentheses, but never counts,
        // weights or already-supplied inch equivalents.
        if (/\b(?:in|inches)\b|″|”/.test(m) && !CM_RE.test(m)) return "";
        const nested = CM_RE.test(m) ? toImperialLine(m.slice(1, -1)) : null;
        if (nested) parentMeasurements++;
        parens.push(nested ? `(${nested})` : m);
        return `\u0000${"p".repeat(parens.length)}\u0000`;
      });
      // Only strip a label before the first measurement, not later axis
      // captions (e.g. "Seat Height:") or another size's label.
      const source = masked.replace(/^([^:|]+):\s*/, (whole, prefix: string) =>
        DIM_AXIS_RE.test(prefix) || CM_RE.test(prefix) || /(?:Seat|Arm)\s+Height$/i.test(prefix) ? whole : "");
      const units = Array.from(source.matchAll(LENGTH_UNIT_RE));
      let count = 0;
      let stripped = source
        .replace(/\d+(?:[.,]\d+)?/g, (value, offset: number) => {
          const end = offset + value.length;
          const before = source.slice(0, offset);
          const after = source.slice(end);
          if (/^[a-zA-Z]+/.test(after) && !/^(?:cm\b|mm\b|m\b|[WDLHP](?:\s|[×x]|$))/.test(after)) return value;
          if (/^[WDLHP]\b/.test(after) && /^\s*[-–—]/.test(after.slice(1))) return value;
          // Product codes (ARA20), counts, weights and lead times are not
          // lengths. Axis suffixes such as 608W remain valid measurements.
          if (/[a-z]\d*$/i.test(before) && !/(?:\b(?:W|D|H|L|P|SH|AH|AR|Ht|Dia|Diam|Diameter))\.?$/i.test(before) && !/\d[xX]$/.test(before)) return value;
          if (/^\s*(?:kg|g|lb|lbs|weeks?|days?|seaters?|lights?|lengths?|V|HZ|W\b)/i.test(after) && !/^W\s*[×x]/i.test(after)) return value;
          const unit = units.find((u) => (u.index ?? 0) >= end);
          if (!unit) return value;
          const between = source.slice(end, unit.index);
          if (/\b(?:kg|weeks?|days?|seaters?|lights?|lengths?|COM|COL)\b/i.test(between)) return value;
          // A leading numbered label is preserved ("Concept 1:").
          if (/^\s*:/.test(after)) return value;
          const divisor = unit[0].toLowerCase() === "mm" ? 25.4 : unit[0].toLowerCase() === "m" ? 0.0254 : 2.54;
          count++;
          return (Number(value.replace(",", ".")) / divisor).toFixed(1);
        })
        .replace(/\s*(?<![a-zA-Z])(?:[cC][mM]|[mM][mM]|m)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
      stripped = stripped.replace(/\u0000(p+)\u0000/g, (_, token: string) => ` ${parens[token.length - 1]}`).replace(/\s+/g, " ").trim();
      if (!stripped || (!count && !parentMeasurements)) return part;
      if (!count) return stripped;
      // Keep weights and other supplier annotations outside the inch unit.
      const annotation = stripped.match(/\s+([–—-]|\/)\s+((?:W:\s*)?\d+(?:[.,]\d+)?\s*kg\b.*)$/i);
      if (annotation) return `${stripped.slice(0, annotation.index).trim()} in ${annotation[1]} ${annotation[2]}`;
      // Place the inch unit before any trailing parenthetical label.
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
    .map((line) => {
      const { dim, qual } = splitDimensionQualifier(line.trim());
      const imp = toImperialLine(dim);
      if (!imp) return null;
      return qual ? `${imp} — ${qual}` : imp;
    })
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
      const rawLine = line.trim();
      // Peel off any trailing " — <qualifier>" so imperial conversion runs
      // ONLY on the dimension portion (otherwise the digits inside
      // "10 Lights" would be cm→in converted).
      const { dim: t, qual } = splitDimensionQualifier(rawLine);
      const imp = toImperialLine(t);
      const suffix = qual ? ` — ${qual}` : "";
      if (!imp) return rawLine;
      // Strip any leading label words shared with the metric line so the
      // imperial parenthetical doesn't repeat "Sofa Double Depth" etc.
      const metricWords = t.split(/\s+/);
      const impWords = imp.split(/\s+/);
      // Preserve axis labels (W / H / D / L / Dia / Ø / ⌀) on the imperial
      // side by refusing to strip them as "shared prefix" words. Otherwise
      // "Small W 12 × H 12.5 cm" collapses to "4.7 × H 4.9 in" instead of
      // "W 4.7 × H 4.9 in".
      const isAxisMarker = (w: string) =>
        /^(?:[WHDLwhdl]|Dia|dia|Ø|⌀)$/.test(w);
      let i = 0;
      while (
        i < metricWords.length &&
        i < impWords.length &&
        metricWords[i] === impWords[i] &&
        !/[\d"Ø⌀×x]/.test(impWords[i]) &&
        !isAxisMarker(impWords[i])
      ) {
        i++;
      }
      let trimmedImp = impWords.slice(i).join(" ").trim();

      // Strip trailing prose shared with the metric line so text like
      // " - Stem height TBC on order" doesn't duplicate after the "|".
      const impArr = trimmedImp.split(/\s+/);
      const metricArr = t.split(/\s+/);
      let impEnd = impArr.length;
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
        trimmedImp = stripped.join(" ").trim();
      }

      if (!trimmedImp) return `${t}${suffix}`;

      // If the metric line has trailing prose AFTER the last cm cluster
      // (e.g. "Ø 12 x H 24 cm - Stem height TBC on order"), move that prose
      // to after the imperial conversion so the cm/in pair stays together:
      //   "Ø 12 x H 24 cm | Ø 4.7 x H 9.4 in - Stem height TBC on order"
      const lastCmMatch = t.match(/^(.*\bcm\b)(?!.*\bcm\b)(.*)$/i);
      if (lastCmMatch) {
        const head = lastCmMatch[1].trim();
        const tail = lastCmMatch[2].trim().replace(/^[-–—,;:.]+\s*/, "").trim();
        if (tail) return `${head} | ${trimmedImp} - ${tail}${suffix}`;
      }
      return `${t} | ${trimmedImp}${suffix}`;
    })
    .join("\n");
};

/**
 * Stack metric and imperial dimensions on separate lines:
 *   W 65 x D 80 x H 82 cm
 *   W 25.6 x D 31.5 x H 32.3 in
 *
 * Each convertible metric line is immediately followed by its imperial
 * conversion. Used on desktop product pages where the inline pipe format
 * feels too dense.
 */
export const withImperialStacked = (raw: string | null | undefined): string => {
  const metric = formatDimensionsMultiline(raw);
  if (!metric) return "";
  const out: string[] = [];
  metric.split("\n").forEach((line) => {
    const rawLine = line.trim();
    if (!rawLine) return;
    const imp = toImperialLine(rawLine);
    out.push(rawLine);
    if (imp && imp !== rawLine) out.push(imp);
  });
  return out.join("\n");
};


/**
 * Peel dimension segments out of a variant label so a legend line like
 *   "Bronze · Chintz · W 15.5 × D 11 × H 57 cm"
 * becomes
 *   { finish: "Bronze · Chintz", dims: "W 15.5 × D 11 × H 57 cm" }.
 *
 * Splits on the same " · " / " • " / ";" separators the quote UI uses to
 * concatenate variant tokens, then classifies each chunk as "dimensional"
 * when it contains a cm/mm/inch unit or a ×/x/Ø token. Chunks without any
 * are treated as finish/fabric tokens.
 */
export const splitFinishAndDimensions = (
  variantLabel: string | null | undefined,
): { finish: string; dims: string } => {
  const raw = (variantLabel || "").trim();
  if (!raw) return { finish: "", dims: "" };
  const parts = raw.split(/\s+[·•;]\s+/).map((p) => p.trim()).filter(Boolean);
  const isDim = (chunk: string) =>
    DIM_UNIT_RE.test(chunk) || /[×xX]\s*\d/.test(chunk) || /Ø\s*\d/.test(chunk);
  const dims: string[] = [];
  const finish: string[] = [];
  for (const p of parts) (isDim(p) ? dims : finish).push(p);
  return { finish: finish.join(" · "), dims: dims.join(" · ") };
};

/**
 * Human-readable dimensions string with dual units: "W 15.5 × D 11 × H 57 cm | W 6.1 × D 4.3 × H 22.4 in".
 * Falls back to the metric string if the imperial conversion can't be computed.
 */
export const withImperialInline = (dims: string | null | undefined): string => {
  const t = (dims || "").trim();
  if (!t) return "";
  const imp = toImperialLine(t);
  return imp ? `${t} | ${imp}` : t;
};





