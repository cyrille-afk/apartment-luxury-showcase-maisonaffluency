import { expect, it } from "vitest";
import { completePriceSave } from "./priceSaveFeedback";
it("confirms only the price revision that was saved", () => {
  expect(completePriceSave({ revision: 2, status: "saving" }, 2, true, "2026-10-28T01:48:00Z")).toEqual({ revision: 2, status: "saved", confirmedAt: "2026-10-28T01:48:00Z" });
});
it("keeps newer edits unsaved when an earlier save finishes", () => {
  expect(completePriceSave({ revision: 3, status: "unsaved" }, 2, true, "now")).toEqual({ revision: 3, status: "unsaved" });
});
it("does not claim a failed or unconfirmed write was saved", () => {
  expect(completePriceSave({ revision: 1, status: "saving" }, 1, false, "now")).toEqual({ revision: 1, status: "failed" });
});