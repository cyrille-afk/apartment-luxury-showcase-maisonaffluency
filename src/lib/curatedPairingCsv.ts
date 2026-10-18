import Papa from "papaparse";
import type { PairingRule } from "./curatedPairings";
import { PAIRING_FINISH_CURRENCIES, pairingFinishError, parsePairingFinishOptions, type PairingFinishOption } from "./pairingFinishPricing";

const columns = ["rule_id", "source_category", "target_category", "preferred_pick_id", "product_name", "finish_id", "finish_name", "retail_price", "currency"];
export interface PairingCsvUpdate { rule: PairingRule; options: PairingFinishOption[]; currency: string }
export interface PairingCsvPreview { updates: PairingCsvUpdate[]; errors: string[] }

export function exportPairingCsv(rules: PairingRule[], productNames: Map<string, string>): string {
  const data = rules.flatMap((rule) => {
    const options = parsePairingFinishOptions(rule.finish_options);
    return (options.length ? options : [null]).map((option) => [rule.id, rule.source_category, rule.target_category,
      rule.preferred_pick_id || "", productNames.get(rule.preferred_pick_id || "") || "", option?.id || "", option?.name || "",
      option?.price_cents == null ? "" : (option.price_cents / 100).toFixed(2), rule.finish_currency || "USD"]);
  });
  return "\uFEFF" + Papa.unparse({ fields: columns, data }, { escapeFormulae: true, newline: "\r\n" });
}

export function parsePairingCsv(text: string, rules: PairingRule[], products: { id: string; category: string | null }[]): PairingCsvPreview {
  const errors: string[] = [];
  if (text.length > 2_000_000) return { updates: [], errors: ["Use a CSV file smaller than 2 MB."] };
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: "greedy" });
  if (parsed.errors.length) return { updates: [], errors: parsed.errors.map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`) };
  const fields = parsed.meta.fields || [];
  if (columns.some((key) => !fields.includes(key)) || fields.some((key) => !columns.includes(key))) return { updates: [], errors: [`Use these CSV columns: ${columns.join(", ")}.`] };
  if (!parsed.data.length || parsed.data.length > 5000) return { updates: [], errors: ["Include between 1 and 5,000 finish rows."] };
  const groups = new Map<string, { rule: PairingRule; options: PairingFinishOption[]; currency: string; defaults: boolean }>();
  parsed.data.forEach((row, index) => {
    const fail = (message: string) => errors.push(`Row ${index + 2}: ${message}`);
    const rule = rules.find((r) => r.id === row.rule_id.trim());
    if (!rule) { fail("Unknown pairing reference. Export the current catalog first."); return; }
    if (row.preferred_pick_id.trim() !== (rule.preferred_pick_id || "") || row.source_category.trim() !== rule.source_category || row.target_category.trim() !== rule.target_category) {
      fail("The piece or categories no longer match this pairing. Export the current catalog again."); return;
    }
    const currency = row.currency.trim().toUpperCase();
    if (!PAIRING_FINISH_CURRENCIES.includes(currency)) { fail("Unsupported price currency."); return; }
    const previous = groups.get(rule.id);
    if (previous && previous.currency !== currency) { fail("All finishes in a pairing must use the same currency."); return; }
    const group = previous || { rule, options: [], currency, defaults: false };
    groups.set(rule.id, group);
    const name = row.finish_name.replace(/^'(?=[=+\-@\t\r])/, "").trim();
    const price = row.retail_price.trim();
    const id = row.finish_id.trim();
    if (!name && !price && !id) {
      if (previous) fail("A catalogue-default row cannot be mixed with other finish rows.");
      group.defaults = true; return;
    }
    if (group.defaults) { fail("A catalogue-default row cannot be mixed with other finish rows."); return; }
    if (!products.some((p) => p.id === rule.preferred_pick_id && p.category === rule.target_category)) { fail("Custom finishes require a published preferred piece in the complementary category."); return; }
    if (price && !/^\d+(\.\d{1,2})?$/.test(price)) { fail("Retail prices must use a decimal point, at most two decimals, and no thousands separators."); return; }
    const cents = price ? Math.round(Number(price) * 100) : null;
    group.options.push({ id: id || crypto.randomUUID(), name, price_cents: cents });
  });
  for (const group of groups.values()) {
    const error = pairingFinishError(group.options, group.rule.preferred_pick_id);
    if (error) errors.push(`${group.rule.source_category} → ${group.rule.target_category}: ${error}`);
  }
  return { updates: errors.length ? [] : Array.from(groups.values()), errors };
}

export function pairingCsvSnapshot(rule: PairingRule): string {
  return JSON.stringify([rule.preferred_pick_id, rule.source_category, rule.target_category, rule.finish_currency || "USD", rule.finish_options || []]);
}