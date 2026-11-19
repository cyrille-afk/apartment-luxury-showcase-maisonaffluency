import { expect, it } from "vitest";
import { adminRecoveryKey, hasRecoveryChanges, parseAdminRecovery } from "./adminDraftRecovery";

it("isolates recovery by account and project", () => {
  expect(adminRecoveryKey("alice", "cipriani")).not.toBe(adminRecoveryKey("bob", "cipriani"));
  expect(adminRecoveryKey("alice", "cipriani")).not.toBe(adminRecoveryKey("alice", "other"));
});
it("restores unsaved developer, layout, package and open assignment values exactly", () => {
  const draft = { version: 1, updatedAt: 123, developerId: "dev", layoutId: "residence", developer: { developer_name: "Unsaved Cipriani", developer_logo_url: "logo.png", hero_image_url: "hero.jpg" }, layout: { name: "Penthouse draft", floorplan_url: "plan.png", specs_label: "3 Bed", room_environment_glb: "room.glb" }, packages: [{ moodboard_id: "board", tier_name: "Essential draft", package_price: "200000", currency: "SGD", description: "draft", allow_alternatives: false }], assignment: { index: 0, draft: { moodboard_id: "board", tier_name: "Editing", package_price: "210000", currency: "SGD", description: "unfinished" } } };
  expect(parseAdminRecovery(JSON.stringify(draft))).toEqual(draft);
  expect(hasRecoveryChanges(draft as NonNullable<ReturnType<typeof parseAdminRecovery>>)).toBe(true);
});
it("keeps an unsaved removal of all packages recoverable", () => {
  expect(hasRecoveryChanges({ version: 1, updatedAt: 1, developerId: "d", layoutId: "l", packages: [] })).toBe(true);
  expect(hasRecoveryChanges({ version: 1, updatedAt: 1, developerId: "d", layoutId: "l" })).toBe(false);
});
it("rejects corrupted and incompatible local records", () => {
  for (const raw of [null, "broken", '{"version":2}', '{"version":1,"packages":"wrong"}']) expect(parseAdminRecovery(raw)).toBeNull();
});