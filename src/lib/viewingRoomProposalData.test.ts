import { describe, expect, it } from "vitest";
import { proposalConfiguredTotal, proposalSelectedFinishes, proposalSchedulePages } from "./viewingRoomProposalData";
import type { ViewingRoomChoice } from "./viewingRoom";
const material = (id: string, name: string) => ({ id, name, category: "Wood", brand_name: "Kerstens", image_url: null, material_type: null, color_family: null });
const item: ViewingRoomChoice = { id: "00000000-0000-0000-0000-000000000001", product_name: "Rift CTS", category: null, subcategory: null, image_url: null, dimensions: null, width_mm: null, height_mm: null, depth_mm: null, glb_url: null, lead_time: "16 weeks", materials: { base: material("oak", "Ebonized Oak"), top: material("stone", "Brown Travertine"), "default-143": material("143", "143") }, retail_price: 32398.30, retail_price_from: false, finish_options: [], size_options: [] };
describe("private proposal selected data", () => {
  it("uses selected line totals, never the US$700,000 target", () => expect(proposalConfiguredTotal({ package: "Bespoke", currency: "USD", total: 700000, items: [item, { ...item, retail_price: 9016.70 }] })).toBe(4141500));
  it("refuses an unconfirmed selected price", () => expect(() => proposalConfiguredTotal({ package: "Bespoke", currency: "USD", total: 700000, items: [{ ...item, retail_price: null }] })).toThrow());
  it("includes only the selected oak and travertine, never supplier defaults", () => expect(proposalSelectedFinishes(item).map(f => f.name)).toEqual(["Ebonized Oak", "Brown Travertine"]));
  it("never displays a raw numeric finish ID", () => expect(proposalSelectedFinishes({ ...item, materials: { base: material("143", "143") } })[0]?.name).toBe("Selected Wood — name to be confirmed"));
  it("groups the schedule as two complete items per page", () => expect(proposalSchedulePages([item, item, item, item, item]).map(page => page.length)).toEqual([2, 2, 1]));
});