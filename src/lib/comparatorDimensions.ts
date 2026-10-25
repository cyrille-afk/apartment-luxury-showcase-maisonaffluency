export interface ComparatorDimension { label: string; metric: string; imperial: string }
export interface ComparatorDimensionGroup { name: string; rows: ComparatorDimension[]; note: string }

const AXIS = "Seat\\s+Height|Arm\\s+Height|Overall\\s+Height|Width|Depth|Height|Length|Diameter|Thickness|SH|AH|AR|Dia(?:m)?|Ht|W|D|H|L|P|T|Ø|⌀";
const NUMBER = "\\d+(?:[.,]\\d+)?(?:\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)?";
const UNIT = "cm|mm|inches|inch|in|m|[\"″”]";
const labels: Record<string, string> = { w: "Width", width: "Width", d: "Depth", p: "Depth", depth: "Depth", h: "Height", ht: "Height", height: "Height", overallheight: "Height", l: "Length", length: "Length", sh: "Seat Height", seatheight: "Seat Height", ah: "Arm Height", ar: "Arm Height", armheight: "Arm Height", dia: "Diameter", diam: "Diameter", diameter: "Diameter", "ø": "Diameter", "⌀": "Diameter", t: "Thickness", thickness: "Thickness" };
const cleanLabel = (axis: string) => labels[axis.toLowerCase().replace(/[\s.]/g, "")] ?? axis;
const unitMatches = (text: string) => [...text.matchAll(new RegExp(`(?<![a-z])(${UNIT})(?![a-z²])`, "gi"))];
const isMetric = (unit: string) => /^(cm|mm|m)$/i.test(unit);
const formatCm = (value: number) => String(Number(value.toFixed(2)));

function dimension(label: string, raw: string, unit: string): ComparatorDimension | null {
  const values = raw.split(/\s*[-–]\s*/).map(v => Number(v.replace(",", ".")));
  if (values.some(v => !Number.isFinite(v) || v <= 0)) return null;
  const factor = unit.toLowerCase() === "mm" ? 0.1 : unit.toLowerCase() === "m" ? 100 : isMetric(unit) ? 1 : 2.54;
  const cm = values.map(v => v * factor);
  return { label, metric: `${cm.map(formatCm).join("–")} cm`, imperial: `${cm.map(v => (v / 2.54).toFixed(1)).join("–")} in` };
}

/** Parse recorded lengths only; supplier inch duplicates and product-code numbers are not extra sizes. */
export function comparatorDimensionGroups(raw: string | null | undefined): ComparatorDimensionGroup[] {
  const lines = (raw ?? "").split(/\n|\s*[,/]\s+(?=[^,:]*?:\s)/).map(v => v.trim()).filter(Boolean);
  const groups: ComparatorDimensionGroup[] = [];
  const signatures = new Set<string>();
  for (const line of lines) {
    const hasMetric = unitMatches(line).some(m => isMetric(m[1]));
    let source = line.split("|").filter(part => {
      const units = unitMatches(part);
      return !hasMetric || !units.length || units.some(m => isMetric(m[1]));
    }).join(" | ").replace(/\([^)]*(?:\bin(?:ches)?\b|["″”])[^)]*\)/gi, "");
    // For stacked unit pairs, the imperial line belongs to the preceding metric group.
    if (!hasMetric && unitMatches(source).length && unitMatches(source).every(m => !isMetric(m[1])) && groups.length) {
      const prior = lines[lines.indexOf(line) - 1] ?? "";
      if (unitMatches(prior).some(m => isMetric(m[1]))) continue;
    }
    const units = unitMatches(source);
    const rows: ComparatorDimension[] = [];
    const token = new RegExp(`(?<![a-z0-9])(${AXIS})\\.?\\s*:?\\s*(${NUMBER})\\s*(${UNIT})?(?![a-z])|(?<![a-z0-9])(${NUMBER})\\s*(${AXIS})\\.?(?![a-z])\\s*(${UNIT})?`, "gi");
    const matches = [...source.matchAll(token)];
    let name = "";
    if (matches.length) {
      name = source.slice(0, matches[0].index).replace(/[\s:–—(\-|]+$/g, "").trim();
      for (const match of matches) {
        const end = (match.index ?? 0) + match[0].length;
        const unit = match[3] || match[6] || units.find(m => (m.index ?? 0) >= end)?.[1] || units.at(-1)?.[1];
        if (!unit || (hasMetric && !isMetric(unit))) continue;
        const row = dimension(cleanLabel(match[1] || match[5]), match[2] || match[4], unit);
        if (row && !rows.some(r => r.label === row.label && r.metric === row.metric)) rows.push(row);
      }
    } else {
      // Only assign positional axes to a complete plain cluster, not arbitrary prose numbers.
      const cluster = source.match(new RegExp(`^\\s*(?:([^:]+):\\s*)?(${NUMBER}(?:\\s*[xX×|]\\s*${NUMBER}){1,2})\\s*(${UNIT})\\s*$`, "i"));
      if (cluster) {
        name = cluster[1]?.trim() ?? "";
        cluster[2].split(/\s*[xX×|]\s*/).forEach((value, index) => {
          const row = dimension(["Width", "Depth", "Height"][index], value, cluster[3]);
          if (row) rows.push(row);
        });
      }
    }
    const order = ["Width", "Length", "Depth", "Diameter", "Height", "Thickness", "Seat Height", "Arm Height"];
    rows.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
    const signature = JSON.stringify(rows);
    if (rows.length && !signatures.has(`${name}:${signature}`)) {
      signatures.add(`${name}:${signature}`);
      groups.push({ name, rows, note: "" });
    } else if (!rows.length && !/\bin(?:ches)?\b|["″”]/i.test(source)) {
      source = source.trim();
      if (source) groups.push({ name: "", rows: [], note: source });
    }
  }
  return groups;
}