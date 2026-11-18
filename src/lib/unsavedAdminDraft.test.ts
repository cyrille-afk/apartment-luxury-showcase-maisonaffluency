import { expect, it } from "vitest";
import {
  developerDraftDirty,
  hasUnsavedAdminDraft,
  layoutDraftDirty,
  packagesDraftDirty,
  registerUnsavedAdminDraft,
  type SavedDeveloper,
  type SavedLayout,
  type SavedPackageRow,
} from "./unsavedAdminDraft";

const developer = { developer_name: "Cipriani", developer_logo_url: "logo.png", hero_image_url: "hero.jpg" };
const savedDeveloper: SavedDeveloper = { developer_name: "Cipriani", developer_logo_url: "logo.png", hero_image_url: "hero.jpg" };

it("treats a developer form that matches its saved row as saved", () => {
  expect(developerDraftDirty(developer, savedDeveloper)).toBe(false);
});
it("flags a renamed developer and a renamed developer trimmed the same way", () => {
  expect(developerDraftDirty({ ...developer, developer_name: "Cipriani Miami" }, savedDeveloper)).toBe(true);
  expect(developerDraftDirty({ ...developer, developer_name: "  Cipriani  " }, savedDeveloper)).toBe(false);
});
it("treats a missing saved row as saved only while the form is still empty", () => {
  expect(developerDraftDirty({ developer_name: "", developer_logo_url: "", hero_image_url: "" }, null)).toBe(false);
  expect(developerDraftDirty({ developer_name: "New house", developer_logo_url: "", hero_image_url: "" }, null)).toBe(true);
});
it("keeps null and empty media paths equivalent", () => {
  expect(developerDraftDirty({ developer_name: "Cipriani", developer_logo_url: "", hero_image_url: "" }, { developer_name: "Cipriani", developer_logo_url: null, hero_image_url: null })).toBe(false);
});

const layout = { name: "Penthouse", floorplan_url: "plan.png", specs_label: "3 Bed", room_environment_glb: "" };
const savedLayout: SavedLayout = { name: "Penthouse", floorplan_url: "plan.png", specs_label: "3 Bed", room_environment_glb: null };

it("treats a layout form that matches its saved row as saved", () => {
  expect(layoutDraftDirty(layout, savedLayout)).toBe(false);
});
it("flags an edited layout and an unsaved new layout with typed content", () => {
  expect(layoutDraftDirty({ ...layout, specs_label: "4 Bed" }, savedLayout)).toBe(true);
  expect(layoutDraftDirty({ name: "", floorplan_url: "", specs_label: "", room_environment_glb: "" }, null)).toBe(false);
  expect(layoutDraftDirty({ name: "Villa", floorplan_url: "", specs_label: "", room_environment_glb: "" }, null)).toBe(true);
});

const savedRow: SavedPackageRow = {
  moodboard_id: "b1",
  tier_name: "Essential",
  package_price: 29202,
  currency: "EUR",
  description: "",
  lead_time_weeks: null,
  allow_alternatives: true,
};
const matchingDraft = { moodboard_id: "b1", tier_name: "Essential", package_price: "29202", currency: "EUR", description: "", lead_time_weeks: "", allow_alternatives: true };

it("treats packages rehydrated from their saved rows as saved", () => {
  expect(packagesDraftDirty([matchingDraft], [savedRow])).toBe(false);
});
it("flags an edited package price, a removed tier and a swap toggle", () => {
  expect(packagesDraftDirty([{ ...matchingDraft, package_price: "29203" }], [savedRow])).toBe(true);
  expect(packagesDraftDirty([], [savedRow])).toBe(true);
  expect(packagesDraftDirty([{ ...matchingDraft, allow_alternatives: false }], [savedRow])).toBe(true);
});
it("keeps saved lead weeks and null equivalent to an empty draft field", () => {
  expect(packagesDraftDirty([{ ...matchingDraft, lead_time_weeks: "8" }], [{ ...savedRow, lead_time_weeks: 8 }])).toBe(false);
  expect(packagesDraftDirty([{ ...matchingDraft, tier_name: " Essential " }], [savedRow])).toBe(false);
});

it("reports unsaved work only while a manager is registered", () => {
  expect(hasUnsavedAdminDraft()).toBe(false);
  let dirty = true;
  const release = registerUnsavedAdminDraft(() => dirty);
  expect(hasUnsavedAdminDraft()).toBe(true);
  dirty = false;
  expect(hasUnsavedAdminDraft()).toBe(false);
  dirty = true;
  release();
  expect(hasUnsavedAdminDraft()).toBe(false);
});
it("never lets a released manager clear a newer one", () => {
  const first = registerUnsavedAdminDraft(() => true);
  const second = registerUnsavedAdminDraft(() => false);
  first();
  expect(hasUnsavedAdminDraft()).toBe(false);
  second();
  expect(hasUnsavedAdminDraft()).toBe(false);
});
