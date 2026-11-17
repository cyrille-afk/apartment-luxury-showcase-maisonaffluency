import { describe, expect, it } from "vitest";
import { viewingRoomPackageError, type ViewingRoomPackageDraft } from "./viewingRoomPackages";
const ids = ["a", "b", "c", "d", "e", "f"];
const rows = (count: number): ViewingRoomPackageDraft[] => ids.slice(0, count).map((id, index) => ({ moodboard_id: id, tier_name: `Tier ${index}`, package_price: "200000", currency: "USD", description: "" }));
describe("viewing room packages", () => {
  it("requires at least 3 packages", () => { expect(viewingRoomPackageError(rows(2), ids)).not.toBeNull(); expect(viewingRoomPackageError(rows(3), ids)).toBeNull(); });
  it("allows at most 5 packages", () => { expect(viewingRoomPackageError(rows(5), ids)).toBeNull(); expect(viewingRoomPackageError(rows(6), ids)).not.toBeNull(); });
  it("refuses a board outside the project", () => { expect(viewingRoomPackageError(rows(3), ["a", "b"])).not.toBeNull(); });
  it("requires distinct existing moodboards", () => { const list = rows(3); list[2].moodboard_id = "a"; expect(viewingRoomPackageError(list, ids)).not.toBeNull(); });
});