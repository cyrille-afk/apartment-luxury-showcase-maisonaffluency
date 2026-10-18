import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { exportPairingCsv, parsePairingCsv, pairingCsvSnapshot } from "./curatedPairingCsv";
import type { PairingRule } from "./curatedPairings";

const rule: PairingRule = { id: "rule-1", source_category: "ceiling", target_category: "tables", preferred_pick_id: "pick-1", enabled: true, sort_order: 8, finish_currency: "USD", finish_options: [
  { id: "finish-1", name: 'Oak, "Écru"\nHoned', price_cents: 290000 }, { id: "finish-2", name: "Bronze", price_cents: null },
] };
const products = [{ id: "pick-1", category: "tables" }];
const names = new Map([["pick-1", "APPARATUS — Segment Console"]]);
function editCsv(change: (rows: Record<string, string>[]) => void) {
  const parsed = Papa.parse<Record<string, string>>(exportPairingCsv([rule], names), { header: true, skipEmptyLines: true });
  change(parsed.data);
  return Papa.unparse(parsed.data);
}
describe("curated pairing finish CSV", () => {
  it("round-trips finish IDs, quoted names, accents, newlines, exact prices and request-only prices", () => {
    const parsed = parsePairingCsv(exportPairingCsv([rule], names), [rule], products);
    expect(parsed.errors).toEqual([]);
    expect(parsed.updates[0].options).toEqual(rule.finish_options);
    expect(parsed.updates[0].currency).toBe("USD");
  });
  it("imports edited prices in cents without altering priorities or status", () => {
    const parsed = parsePairingCsv(editCsv((rows) => { rows[0].retail_price = "87.29"; }), [rule], products);
    expect(parsed.updates[0].options[0].price_cents).toBe(8729);
    expect(parsed.updates[0].rule.sort_order).toBe(8);
    expect(parsed.updates[0].rule.enabled).toBe(true);
  });
  it("imports only included pairings and preserves omitted pairing records", () => {
    const other = { ...rule, id: "other", sort_order: 4 };
    const parsed = parsePairingCsv(exportPairingCsv([rule], names), [rule, other], products);
    expect(parsed.updates.map((u) => u.rule.id)).toEqual(["rule-1"]);
    expect(other.sort_order).toBe(4);
  });
  it("restores catalogue defaults with a blank finish row", () => {
    const defaults = { ...rule, finish_options: [] };
    expect(parsePairingCsv(exportPairingCsv([defaults], names), [rule], products).updates[0].options).toEqual([]);
  });
  it("creates a stable finish reference for a newly added finish", () => {
    const parsed = parsePairingCsv(editCsv((rows) => { rows.push({ ...rows[0], finish_id: "", finish_name: "New oak" }); }), [rule], products);
    expect(parsed.errors).toEqual([]);
    expect(parsed.updates[0].options[2].id).toMatch(/^[0-9a-f-]{36}$/);
  });
  it.each(["0", "-1", "1.999", "1,000", "NaN", "1e3", "10000000.01"])("rejects invalid or out-of-range retail price %s without producing updates", (price) => {
    const result = parsePairingCsv(editCsv((rows) => { rows[0].retail_price = price; }), [rule], products);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.updates).toEqual([]);
  });
  it.each(["rule_id", "preferred_pick_id", "source_category", "target_category"])("rejects stale or unknown %s", (field) => {
    expect(parsePairingCsv(editCsv((rows) => { rows[0][field] = "changed"; }), [rule], products).updates).toEqual([]);
  });
  it("rejects duplicate finish references", () => {
    expect(parsePairingCsv(editCsv((rows) => { rows[1].finish_id = rows[0].finish_id; }), [rule], products).errors.length).toBeGreaterThan(0);
  });
  it("rejects finish references exceeding the saved catalog limit", () => {
    expect(parsePairingCsv(editCsv((rows) => { rows[0].finish_id = "x".repeat(81); }), [rule], products).updates).toEqual([]);
  });
  it("rejects duplicate finish names", () => {
    expect(parsePairingCsv(editCsv((rows) => { rows[1].finish_name = rows[0].finish_name; }), [rule], products).errors.length).toBeGreaterThan(0);
  });
  it("rejects mixed currencies", () => {
    expect(parsePairingCsv(editCsv((rows) => { rows[1].currency = "GBP"; }), [rule], products).errors.length).toBeGreaterThan(0);
  });
  it("rejects unsupported currency", () => {
    expect(parsePairingCsv(editCsv((rows) => { rows.forEach((r) => { r.currency = "ZZZ"; }); }), [rule], products).errors.length).toBeGreaterThan(0);
  });
  it("rejects unpublished or mismatched pieces", () => {
    expect(parsePairingCsv(exportPairingCsv([rule], names), [rule], []).updates).toEqual([]);
    expect(parsePairingCsv(exportPairingCsv([rule], names), [rule], [{ id: "pick-1", category: "decor" }]).updates).toEqual([]);
  });
  it("rejects mixing defaults with custom finishes", () => {
    expect(parsePairingCsv(editCsv((rows) => { rows.push({ ...rows[0], finish_id: "", finish_name: "", retail_price: "" }); }), [rule], products).updates).toEqual([]);
  });
  it("limits finishes to 50 per pairing", () => {
    const csv = editCsv((rows) => { const original = { ...rows[0] }; rows.splice(0, rows.length, ...Array.from({ length: 51 }, (_, i) => ({ ...original, finish_id: `f-${i}`, finish_name: `Finish ${i}` }))); });
    expect(parsePairingCsv(csv, [rule], products).errors).toContain("ceiling → tables: Use no more than 50 finish choices.");
  });
  it("escapes spreadsheet formulae on export while retaining finish names on reimport", () => {
    const dangerous = { ...rule, finish_options: [{ id: "f", name: "=HYPERLINK(\"https://example.com\")", price_cents: 10 }] };
    const csv = exportPairingCsv([dangerous], names);
    expect(csv).toContain("'=HYPERLINK");
    expect(parsePairingCsv(csv, [dangerous], products).updates[0].options).toEqual(dangerous.finish_options);
  });
  it("rejects wrong headers, malformed CSV and empty input", () => {
    for (const csv of ["", "foo,bar\na,b", 'rule_id,"unterminated']) expect(parsePairingCsv(csv, [rule], products).errors.length).toBeGreaterThan(0);
  });
  it("detects catalog changes for stale preview checks", () => {
    expect(pairingCsvSnapshot(rule)).not.toBe(pairingCsvSnapshot({ ...rule, finish_currency: "EUR" }));
    expect(pairingCsvSnapshot(rule)).not.toBe(pairingCsvSnapshot({ ...rule, preferred_pick_id: "another" }));
  });
});