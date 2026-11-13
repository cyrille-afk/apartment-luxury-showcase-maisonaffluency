import { describe, expect, it } from "vitest";
import { VISUALISER_ORBIT_SETTINGS } from "./visualiserOrbitSettings";

describe("3D workspace navigation", () => {
  it("enables scroll zoom", () => expect(VISUALISER_ORBIT_SETTINGS.enableZoom).toBe(true));
  it("enables pan", () => expect(VISUALISER_ORBIT_SETTINGS.enablePan).toBe(true));
  it("enables orbit", () => expect(VISUALISER_ORBIT_SETTINGS.enableRotate).toBe(true));
  it("allows at least 20 metres of orbit distance", () => expect(VISUALISER_ORBIT_SETTINGS.maxDistance).toBeGreaterThanOrEqual(20));
});