import { describe, expect, it } from "vitest";
import { advancePlayback, playbackTimeLabel } from "./cinematicPlayback";

describe("walkthrough playback clock", () => {
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