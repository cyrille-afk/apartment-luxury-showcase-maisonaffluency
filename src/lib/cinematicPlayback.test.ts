import { afterEach, describe, expect, it, vi } from "vitest";
import { advancePlayback, cameraTransitionBlend, remapPlaybackTime, playbackTimeLabel, readWalkthroughPreferences, saveWalkthroughPreferences, steppedPlaybackSpeed, WALKTHROUGH_PREFERENCES_KEY, walkthroughShortcut } from "./cinematicPlayback";

describe("walkthrough preferences", () => {
  afterEach(() => { vi.restoreAllMocks(); window.localStorage.removeItem(WALKTHROUGH_PREFERENCES_KEY); });
  it("restores defaults without saved preferences", () => {
    window.localStorage.removeItem(WALKTHROUGH_PREFERENCES_KEY);
    expect(readWalkthroughPreferences()).toEqual({ preset: "sweep", speed: 1, loop: false });
  });
  it("persists each supported preset, speed and both repeat states", () => {
    for (const preset of ["sweep", "slow-orbit", "furniture-tour"] as const) {
      for (const speed of [0.5, 0.75, 1, 1.5, 2]) {
        for (const loop of [true, false]) {
          saveWalkthroughPreferences({ preset, speed, loop });
          expect(readWalkthroughPreferences()).toEqual({ preset, speed, loop });
        }
      }
    }
  });
  it("falls back safely for corrupt or invalid settings", () => {
    for (const raw of ["{broken", "null", "[]", '{"preset":"unknown","speed":99,"loop":"true"}']) {
      window.localStorage.setItem(WALKTHROUGH_PREFERENCES_KEY, raw);
      expect(readWalkthroughPreferences()).toEqual({ preset: "sweep", speed: 1, loop: false });
    }
    window.localStorage.setItem(WALKTHROUGH_PREFERENCES_KEY, '{"preset":"slow-orbit","speed":-1,"loop":true}');
    expect(readWalkthroughPreferences()).toEqual({ preset: "slow-orbit", speed: 1, loop: true });
  });
  it("keeps playback usable when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(readWalkthroughPreferences()).toEqual({ preset: "sweep", speed: 1, loop: false });
    expect(() => saveWalkthroughPreferences({ preset: "sweep", speed: 1, loop: false })).not.toThrow();
  });
});

describe("walkthrough playback clock", () => {
  it("preserves route phase across preset durations and leaves entry intact", () => {
    expect(remapPlaybackTime(22.5, 40, 70)).toBe(37.5);
    expect(remapPlaybackTime(1.2, 40, 70)).toBe(1.2);
    expect(remapPlaybackTime(90, 40, 70)).toBe(72.5);
  });
  it("blends monotonically with gentle endpoints and no overshoot", () => {
    expect(cameraTransitionBlend(0)).toBe(0);
    expect(cameraTransitionBlend(3)).toBe(1);
    expect(cameraTransitionBlend(0.01)).toBeLessThan(0.000001);
    expect(cameraTransitionBlend(2.99)).toBeGreaterThan(0.999999);
    let previous = 0;
    for (let t = 0; t <= 4; t += 0.01) {
      const blend = cameraTransitionBlend(t);
      expect(blend).toBeGreaterThanOrEqual(previous);
      expect(blend).toBeLessThanOrEqual(1);
      previous = blend;
    }
  });
  it("steps speed within supported bounds", () => {
    expect(steppedPlaybackSpeed(1, 1)).toBe(1.5);
    expect(steppedPlaybackSpeed(1, -1)).toBe(0.75);
    expect(steppedPlaybackSpeed(2, 1)).toBe(2);
    expect(steppedPlaybackSpeed(0.5, -1)).toBe(0.5);
  });
  it("recognizes playback keys without taking modified or repeated keys", () => {
    expect(walkthroughShortcut(new KeyboardEvent("keydown", { code: "Space" }))).toBe("toggle");
    expect(walkthroughShortcut(new KeyboardEvent("keydown", { key: "R" }))).toBe("restart");
    expect(walkthroughShortcut(new KeyboardEvent("keydown", { key: "+" }))).toBe("faster");
    expect(walkthroughShortcut(new KeyboardEvent("keydown", { key: "[" }))).toBe("slower");
    expect(walkthroughShortcut(new KeyboardEvent("keydown", { key: "r", ctrlKey: true }))).toBeNull();
    expect(walkthroughShortcut(new KeyboardEvent("keydown", { code: "Space", repeat: true }))).toBeNull();
  });
  it("ignores typing and native playback controls", () => {
    for (const tag of ["input", "textarea", "button", "select"]) {
      const element = document.createElement(tag);
      const event = new KeyboardEvent("keydown", { key: "r" });
      element.dispatchEvent(event);
      expect(walkthroughShortcut(event)).toBeNull();
    }
  });
  it("scales speed and prevents dropped-frame jumps", () => {
    expect(advancePlayback(10, 0.02, 0.5, 30)).toBeCloseTo(10.01);
    expect(advancePlayback(10, 0.02, 2, 30)).toBeCloseTo(10.04);
    expect(advancePlayback(10, 5, 1, 30)).toBeCloseTo(10.05);
  });
  it("clamps at completion and resumes from a seeked position", () => {
    expect(advancePlayback(29.99, 0.05, 2, 30)).toBe(30);
    expect(advancePlayback(15, 0.02, 1, 30)).toBeCloseTo(15.02);
  });
  it("formats timeline labels", () => {
    expect(playbackTimeLabel(0)).toBe("0:00");
    expect(playbackTimeLabel(75.6)).toBe("1:15");
  });
});