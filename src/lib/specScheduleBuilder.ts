/**
 * Deterministic markdown SPECIFICATION SCHEDULE builder.
 *
 * Fed with rows fetched straight from the database — never model output.
 * Any missing/nullish source field is rendered literally as
 * `Data not found in database.` per the copilot zero-hallucination mandate.
 * No inference, no rounding, no unit conversion (all dimensions already mm).
 */

export const MISSING = "Data not found in database.";

export type SpecScheduleItem = {
  product_name: string | null;
  designer: string | null;
  brand_name: string | null;
  category: string | null;
  subcategory?: string | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  seat_height_mm: number | null;
  arm_height_mm?: number | null; // not in schema today; kept for future-proofing
  materials: string | null;
  available_finishes: string[] | null;
  lead_time_weeks_min: number | null;
  lead_time_weeks_max: number | null;
  lead_time: string | null; // free-text fallback
  is_contract_grade: boolean | null;
  image_url: string | null;
  spec_sheet_url: string | null;
  sku: string | null;
};

const s = (v: string | null | undefined): string => {
  if (v === null || v === undefined) return MISSING;
  const t = String(v).trim();
  return t.length ? t : MISSING;
};

const n = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return MISSING;
  return String(v);
};

const dims = (item: SpecScheduleItem): string => {
  const w = n(item.width_mm);
  const d = n(item.depth_mm);
  const h = n(item.height_mm);
  const base =
    w === MISSING && d === MISSING && h === MISSING
      ? MISSING
      : `W: ${w}mm x D: ${d}mm x H: ${h}mm`;
  const seat = item.seat_height_mm != null ? ` (Seat: ${item.seat_height_mm}mm)` : "";
  return base + seat;
};

const finish = (item: SpecScheduleItem): string => {
  const mats = (item.materials ?? "").trim();
  const finishes = (item.available_finishes ?? []).filter(Boolean);
  const parts: string[] = [];
  if (mats) parts.push(mats);
  if (finishes.length) parts.push(finishes.join(", "));
  return parts.length ? parts.join(" | ") : MISSING;
};

const leadTime = (item: SpecScheduleItem): string => {
  const min = item.lead_time_weeks_min;
  const max = item.lead_time_weeks_max;
  if (min != null && max != null) return `${min}-${max} weeks`;
  if (max != null) return `up to ${max} weeks`;
  if (min != null) return `from ${min} weeks`;
  const raw = (item.lead_time ?? "").trim();
  return raw.length ? raw : MISSING;
};

const contract = (item: SpecScheduleItem): string => {
  if (item.is_contract_grade === true) return "Yes";
  if (item.is_contract_grade === false) return "No";
  return MISSING;
};

const assets = (item: SpecScheduleItem): string => {
  const img = (item.image_url ?? "").trim();
  const cad = (item.spec_sheet_url ?? "").trim();
  const parts: string[] = [];
  parts.push(img ? `[Image](${img})` : MISSING);
  parts.push(cad ? `[CAD/Spec](${cad})` : MISSING);
  return parts.join(" | ");
};

const pad2 = (i: number) => String(i + 1).padStart(2, "0");

export function buildSpecSchedule(zone: string, items: SpecScheduleItem[]): string {
  const header = `### SPECIFICATION SCHEDULE: ${zone.trim() || "Untitled Zone"}`;
  if (!items.length) {
    return `${header}\n\n_No items in this tearsheet._`;
  }

  const blocks = items.map((item, i) => {
    const category = [item.category, item.subcategory].filter(Boolean).join(" / ");
    return [
      `**${pad2(i)} | ${s(item.product_name)}**`,
      `- **Designer / Brand:** ${s(item.designer)} | ${s(item.brand_name)}`,
      `- **Category / Typology:** ${category.trim() ? category : MISSING}`,
      `- **Dimensions:** ${dims(item)}`,
      `- **Material & Finish Catalogue:** ${finish(item)}`,
      `- **Technical & Logistics:** Lead Time: ${leadTime(item)} | Contract Grade: ${contract(item)}`,
      `- **SKU:** ${s(item.sku)}`,
      `- **Project Documentation Assets:** ${assets(item)}`,
    ].join("\n");
  });

  return `${header}\n\n${blocks.join("\n\n---\n\n")}\n`;
}
