import { describe, expect, it } from "vitest";
import { normalizeProposalDetails, PROPOSAL_CLIENT_NAME_MAX, PROPOSAL_NOTES_MAX, proposalConfiguredTotal, proposalHasUnpricedItems, proposalSelectedFinishes, proposalSchedulePages, safeProposalUrl } from "./viewingRoomProposalData";
import type { ViewingRoomChoice } from "./viewingRoom";
const material = (id: string, name: string) => ({ id, name, category: "Wood", brand_name: "Kerstens", image_url: null, material_type: null, color_family: null });
const item: ViewingRoomChoice = { id: "00000000-0000-0000-0000-000000000001", product_name: "Rift CTS", category: null, subcategory: null, image_url: null, dimensions: null, width_mm: null, height_mm: null, depth_mm: null, glb_url: null, lead_time: "16 weeks", materials: { base: material("oak", "Ebonized Oak"), top: material("stone", "Brown Travertine"), "default-143": material("143", "143") }, retail_price: 32398.30, retail_price_from: false, finish_options: [], size_options: [] };
describe("private proposal selected data", () => {
  it("uses selected line totals, never the US$700,000 target", () => expect(proposalConfiguredTotal({ package: "Bespoke", currency: "USD", total: 700000, items: [item, { ...item, retail_price: 9016.70 }] })).toBe(4141500));
  it("excludes unconfirmed prices from the total without inventing them", () => {
    const snapshot = { package: "Bespoke", currency: "USD", total: 700000, items: [item, { ...item, retail_price: null }] };
    expect(proposalConfiguredTotal(snapshot)).toBe(3239830);
    expect(proposalHasUnpricedItems(snapshot)).toBe(true);
    expect(proposalHasUnpricedItems({ ...snapshot, items: [item] })).toBe(false);
  });
  it("includes only the selected oak and travertine, never supplier defaults", () => expect(proposalSelectedFinishes(item).map(f => f.name)).toEqual(["Ebonized Oak", "Brown Travertine"]));
  it("never displays a raw numeric finish ID", () => expect(proposalSelectedFinishes({ ...item, materials: { base: material("143", "143") } })[0]?.name).toBe("Selected Wood — name to be confirmed"));
  it("combines a monolithic wood finish shared by top and base into one Finish row", () => {
    const elm = material("elm", "Brushed Elm-ORG.517.005.B.HY");
    expect(proposalSelectedFinishes({ ...item, materials: { top: elm, base: elm } }).map(f => `${f.label}: ${f.name}`)).toEqual(["Finish: Brushed Elm-ORG.517.005.B.HY"]);
  });
  it("groups the schedule as two complete items per page", () => expect(proposalSchedulePages([item, item, item, item, item]).map(page => page.length)).toEqual([2, 2, 1]));
  it("normalizes optional client name and project notes and omits blank values", () => {
    expect(normalizeProposalDetails({ clientName: "   ", projectNotes: "\n  " })).toEqual({});
    expect(normalizeProposalDetails({ clientName: "  Elena   Rossi \n", projectNotes: "  Target move-in Q4.\r\nWarm stone palette.  " })).toEqual({
      clientName: "Elena Rossi",
      projectNotes: "Target move-in Q4.\nWarm stone palette.",
    });
    expect(normalizeProposalDetails({ clientName: "A".repeat(200), projectNotes: "B".repeat(700) })).toEqual({
      clientName: "A".repeat(PROPOSAL_CLIENT_NAME_MAX),
      projectNotes: "B".repeat(PROPOSAL_NOTES_MAX),
    });
  });
  it("sanitizes published spatial render and walkthrough URLs", () => {
    expect(safeProposalUrl("https://maisonaffluency.com/layout/abc")).toBe("https://maisonaffluency.com/layout/abc");
    expect(safeProposalUrl("/__l5e/assets-v1/plan.png")).toBe("/__l5e/assets-v1/plan.png");
    expect(safeProposalUrl("javascript:alert(1)")).toBeNull();
    expect(safeProposalUrl("   ")).toBeNull();
  });
});