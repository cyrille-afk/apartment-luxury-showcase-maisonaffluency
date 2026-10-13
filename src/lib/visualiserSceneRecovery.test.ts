import { describe, expect, it } from "vitest";
import { planRecovery, RECOVERY_LOOP_MS } from "./visualiserSceneRecovery";

describe("planRecovery", () => {
  it("restores the last working scene after a crash", () => {
    expect(planRecovery('{"objects":[1]}', null, 1000)).toEqual({ sandbox: '{"objects":[1]}', outcome: "restored" });
  });
  it("resets to an empty scene if the restored scene crashes again", () => {
    expect(planRecovery('{"objects":[1]}', 1000, 1000 + RECOVERY_LOOP_MS - 1).outcome).toBe("reset");
  });
  it("resets when no working scene was ever recorded", () => {
    expect(planRecovery(null, null, 1000)).toEqual({ sandbox: null, outcome: "reset" });
  });
});
