import { describe, expect, it } from "vitest";
import { emptyHistoryFilters, filterPairingHistory, historyMediaChanges } from "./pairingHistoryFilters";

const photo = { preferred_pick_id: "console", finish_media: [{ key: "custom:oak", label: "Oak", product_image_url: "https://assets.example/oak.jpg" }] };
const texture = { preferred_pick_id: "lamp", finish_media: [{ key: "custom:brass", label: "Brass", macro_image_url: "https://assets.example/brass.jpg" }] };
const entries = [
  { id: "photo", actor_id: "admin-a", created_at: new Date(2026, 9, 18, 0, 0).toISOString(), before_values: {}, after_values: photo },
  { id: "texture", actor_id: "admin-b", created_at: new Date(2026, 9, 18, 23, 59, 59).toISOString(), before_values: {}, after_values: texture },
  { id: "removed", actor_id: "admin-a", created_at: new Date(2026, 9, 19, 0, 0).toISOString(), before_values: photo, after_values: null },
  { id: "price", actor_id: "admin-b", created_at: new Date(2026, 9, 17, 12).toISOString(), before_values: { sort_order: 1 }, after_values: { sort_order: 2 } },
];
const ids = (filter: Partial<typeof emptyHistoryFilters>) => filterPairingHistory(entries, { ...emptyHistoryFilters, ...filter }).map(entry => entry.id);

describe("catalog history filters", () => {
  it("finds product changes including removed products", () => expect(ids({ product: "console" })).toEqual(["photo", "removed"]));
  it("filters by the recorded admin identity", () => expect(ids({ admin: "admin-b" })).toEqual(["texture", "price"]));
  it("includes the entire selected local calendar day, not the following midnight", () => expect(ids({ from: "2026-10-18", to: "2026-10-18" })).toEqual(["photo", "texture"]));
  it("allows open-ended date ranges", () => expect(ids({ from: "2026-10-19" })).toEqual(["removed"]));
  it("finds finish photo assignments and removals", () => expect(ids({ media: "photos" })).toEqual(["photo", "removed"]));
  it("finds only macro texture changes", () => expect(ids({ media: "textures" })).toEqual(["texture"]));
  it("excludes unrelated edits from combined media results", () => expect(ids({ media: "images" })).toEqual(["photo", "texture", "removed"]));
  it("combines product, admin, date and media filters", () => expect(ids({ product: "console", admin: "admin-a", from: "2026-10-18", to: "2026-10-18", media: "photos" })).toEqual(["photo"]));
  it("returns no records for conflicting filters", () => expect(ids({ product: "console", admin: "admin-b" })).toEqual([]));
  it("restores all records with cleared filters", () => expect(ids({})).toEqual(["photo", "texture", "removed", "price"]));
  it("finds an old product when a pairing switches products", () => {
    expect(filterPairingHistory([{ ...entries[0], before_values: photo, after_values: texture }], { ...emptyHistoryFilters, product: "console" })).toHaveLength(1);
  });
  it("shows only matching media rows in mixed updates", () => {
    const changes = historyMediaChanges({}, { ...photo, sort_order: 2 }, "photos");
    expect(changes.map(change => change.field)).toEqual(["Oak · product photo"]);
  });
  it("filters the whole history before pagination", () => {
    const older = [...Array.from({ length: 55 }, (_, index) => ({ ...entries[3], id: String(index) })), entries[0]];
    expect(filterPairingHistory(older, { ...emptyHistoryFilters, media: "photos" }).map(entry => entry.id)).toEqual(["photo"]);
  });
});