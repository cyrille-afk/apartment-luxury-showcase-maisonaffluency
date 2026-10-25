import { expect, it } from "vitest";
import { isLayoutScheduleContinuation, parseScheduleItems, rowInReferenceScope, selectScheduleRows } from "./_layoutContinuation";

it("routes a completed Option 3 brief to its room schedule", () => {
  expect(isLayoutScheduleContinuation("[Layout selected — do NOT re-ask the brief.] I have selected Option 3. Compile using propose_ffe_rows.", true)).toBe(true);
});
it("does not unlock an incomplete brief", () => {
  expect(isLayoutScheduleContinuation("[Layout selected] Option 3 propose_ffe_rows", false)).toBe(false);
});
it("does not change ordinary catalogue requests", () => {
  expect(isLayoutScheduleContinuation("Suggest bar stools for Bangkok", true)).toBe(false);
});

it("splits the Bangkok typology into three named pieces", () => {
  expect(parseScheduleItems("Bar stools, side tables, lounge chairs").map((i) => i.label)).toEqual(["bar stools", "side tables", "lounge chairs"]);
});

it("covers every named piece from the reference brands", () => {
  const rows = [
    { id: "1", title: "Bond Street Stool" },
    { id: "2", title: "Twin Wood Armchair" },
    { id: "3", title: "Elsa side table" },
    { id: "4", title: "Side Table Lamp" },
  ];
  const { rows: picked, missing } = selectScheduleRows(rows, parseScheduleItems("Bar stools, side tables, lounge chairs"), 2);
  expect(missing).toEqual([]);
  expect(picked.map((r) => r.id).sort()).toEqual(["1", "2", "3"]);
});

it("reports a piece the references cannot supply instead of substituting", () => {
  const { missing } = selectScheduleRows([{ id: "1", title: "Bond Street Stool" }], parseScheduleItems("Bar stools, side tables"), 2);
  expect(missing).toEqual(["side tables"]);
});

it("keeps only rows from the brief's reference brands", () => {
  const ids = new Set(["alinea-id"]);
  expect(rowInReferenceScope({ designer_id: "alinea-id" }, ids, ["alinea"])).toBe(true);
  expect(rowInReferenceScope({ brand_name: "Collection Particulière" }, ids, ["collection particuliere"])).toBe(true);
  expect(rowInReferenceScope({ designer_id: "other", brand_name: "Overgaard & Dyrman" }, ids, ["alinea"])).toBe(false);
});
