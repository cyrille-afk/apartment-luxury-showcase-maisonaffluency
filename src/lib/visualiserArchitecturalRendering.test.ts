import { expect, it } from "vitest";
import { ARCHITECTURAL_RENDERING as R } from "./visualiserArchitecturalRendering";
import { environmentSourcePref } from "./visualiserAdvancedRendering";

it("uses a 1.8 architectural key light", () => { expect(R.keyIntensity).toBe(1.8); });
it("uses 0.6m AO radius", () => { expect(R.aoRadius).toBe(0.6); });
it("uses 1.4 AO intensity", () => { expect(R.aoIntensity).toBe(1.4); });
it("uses 0.8 AO distance falloff", () => { expect(R.aoDistanceFalloff).toBe(0.8); });
it("limits bloom to 0.15", () => { expect(R.bloomIntensity).toBe(0.15); });
it("limits bloom to HDR highlights above 1.1", () => { expect(R.bloomThreshold).toBe(1.1); });
it("makes recessed shadow gaps exactly 4cm high", () => { expect(R.shadowGapHeight).toBe(0.04); });
it("preserves the apartment HDR preference", () => { expect(environmentSourcePref("apartment-hdr")).toBe("apartment-hdr"); });