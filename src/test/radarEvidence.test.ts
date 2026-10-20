import { describe, expect, it } from "vitest";
import { radarEvidence } from "@/lib/radarEvidence";

const base = { email: "integrha@yahoo.com", business_reg_number: null, website_or_ig: "https://www.instagram.com/integrhaartistry/", radar_status: "scored", radar_flag: "Credited on built villa projects in Bali.", dnaStatus: "failed" };

describe("radar evidence breakdown", () => {
  it("project credits support a scored ranking", () => {
    expect(radarEvidence(base)[0]).toMatchObject({ label: "Project credits", effect: "supports" });
  });
  it("unverified Instagram, webmail and missing registration are never negative", () => {
    const rows = radarEvidence(base).slice(1);
    expect(rows.every((r) => r.effect === "neutral")).toBe(true);
  });
  it("no project credits when unscored", () => {
    expect(radarEvidence({ ...base, radar_status: "unverified" })[0].effect).toBe("missing");
  });
});
