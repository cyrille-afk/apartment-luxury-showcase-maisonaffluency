import { describe, expect, it } from "vitest";
import { planRecovery, recoverScene, preserveSceneBackup, LAST_GOOD_KEY, CRASH_BACKUP_KEY, RECOVERY_KEY, RECOVERY_LOOP_MS } from "./visualiserSceneRecovery";

describe("planRecovery", () => {
  it("restores the last working scene after a crash", () => {
    expect(planRecovery('{"objects":[1]}', null, 1000)).toEqual({ sandbox: '{"objects":[1]}', outcome: "restored" });
  });
  it("leaves the scene untouched if the restored scene crashes again", () => {
    expect(planRecovery('{"objects":[1]}', 1000, 1000 + RECOVERY_LOOP_MS - 1).outcome).toBe("reset");
  });
  it("leaves the scene untouched when no working scene was ever recorded", () => {
    expect(planRecovery(null, null, 1000)).toEqual({ sandbox: null, outcome: "reset" });
  });
});

describe("crash storage preservation", () => {
  const key = "test-scene";
  const scene = JSON.stringify({ objects: [{ instanceId: "chair", position: [1, 0, 2], scale: 1.3 }] });
  const storage = () => {
    sessionStorage.clear();
    sessionStorage.setItem(key, scene);
    return sessionStorage;
  };
  it("keeps every piece on a crash before the four-second snapshot", () => {
    const s = storage();
    expect(recoverScene(key, s)).toBe("reset");
    expect(s.getItem(key)).toBe(scene);
    expect(s.getItem(CRASH_BACKUP_KEY)).toBe(scene);
  });
  it("cannot overwrite the populated backup on repeated or empty crashes", () => {
    const s = storage();
    preserveSceneBackup(key, s);
    s.setItem(key, '{"objects":[]}');
    recoverScene(key, s);
    recoverScene(key, s);
    expect(s.getItem(CRASH_BACKUP_KEY)).toBe(scene);
  });
  it("never replaces the current layout during a recovery loop", () => {
    const s = storage();
    s.setItem(LAST_GOOD_KEY, '{"objects":[{"instanceId":"old"}]}');
    s.setItem(RECOVERY_KEY, JSON.stringify({ at: Date.now() }));
    expect(recoverScene(key, s)).toBe("reset");
    expect(s.getItem(key)).toBe(scene);
  });
  it("allows recovery again after the thirty-second window", () => {
    expect(planRecovery(scene, 1000, 1000 + RECOVERY_LOOP_MS)).toEqual({ sandbox: scene, outcome: "restored" });
  });
});
