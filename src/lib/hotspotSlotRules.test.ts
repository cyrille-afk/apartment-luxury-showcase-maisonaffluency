import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0305_create_hotspot_slot_rules.sql", "utf8");
describe("hotspot slot rule defaults", () => {
  it("defaults the price difference setting to 25 percent", () => {
    expect(sql).toMatch(/max_price_delta_pct int DEFAULT 25\b/);
  });
  it("enables swapping by default", () => {
    expect(sql).toMatch(/is_swappable boolean DEFAULT true\b/);
  });
  it("enables finish customization by default", () => {
    expect(sql).toMatch(/allow_finish_customization boolean DEFAULT true\b/);
  });
  it("defaults to automatic footprint selection", () => {
    expect(sql).toContain("selection_mode text DEFAULT 'auto_footprint'");
  });
});