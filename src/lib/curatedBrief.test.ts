import { describe, expect, it } from "vitest";
import { criteriaBrief, syncCriteriaBrief } from "./curatedBrief";

describe("criteria synchronization", () => {
  it("tracks a budget change from 50000 to 30000", () => {
    const criteria = { roomType: "living" as const, style: "quiet-luxury" as const, totalBudget: 50000 };
    const before = criteriaBrief(criteria), after = criteriaBrief({ ...criteria, totalBudget: 30000 });
    expect(syncCriteriaBrief(before, before, after)).toBe("Quiet luxury, living room, budget €30,000");
  });
  it("preserves manually edited custom text", () => {
    expect(syncCriteriaBrief("Blue sofa and two chairs", "old criteria", "new criteria")).toBe("Blue sofa and two chairs");
  });
  it("updates room and style without a custom override", () => {
    const next = criteriaBrief({ roomType: "lounge", style: "sculptural", totalBudget: 30000 });
    expect(syncCriteriaBrief("previous", "previous", next)).toBe("Sculptural, lounge room, budget €30,000");
  });
});