import { expect, it } from "vitest";
import { CONTACT_SHADOW, KEY_SHADOW } from "./visualiserGroundLayers";

it("widens the key shadow camera to ±15 metres", () => {
  expect(KEY_SHADOW.cameraExtent).toBe(15);
});

it("covers at least 22 metres with contact shadows", () => {
  expect(CONTACT_SHADOW.minimumScale).toBe(22);
});