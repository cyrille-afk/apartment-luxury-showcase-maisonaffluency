import { describe, expect, it } from "vitest";
import { eyeLevelFrame, eyeLevelOutputBounds, requireStableRoomFrame } from "../../supabase/functions/_shared/eyeLevelFraming";
import { cameraGuideGeometry } from "./eyeLevelCameraGuide";
import { roomCropCamera } from "./roomZone";

describe("complete eye-level room framing", () => {
  it("rejects substantial room-only background changes instead of applying a redesigned room", () => {
    expect(() => requireStableRoomFrame([200, 200, 200], [100, 100, 100])).toThrow("changed the room framing");
    expect(() => requireStableRoomFrame([200, 200, 200], [200, 200, 200])).not.toThrow();
  });
  it("keeps every pixel of the 1312 × 800 shell inside the native canvas", () => {
    const f = eyeLevelFrame(1312, 800);
    expect(f.width / f.height).toBe(1.64);
    expect(f.x).toBeGreaterThanOrEqual(0); expect(f.y).toBeGreaterThanOrEqual(0);
    expect(f.x + f.width).toBeLessThanOrEqual(f.canvasWidth);
    expect(f.y + f.height).toBeLessThanOrEqual(f.canvasHeight);
    expect(f.canvasWidth / f.canvasHeight).toBe(16 / 9);
    expect(eyeLevelOutputBounds(f, f.canvasWidth, f.canvasHeight)).toEqual({ x: f.x, y: f.y, width: 1312, height: 800 });
  });
  it("rejects the square output that previously cut off the wide shell", () => {
    expect(() => eyeLevelOutputBounds(eyeLevelFrame(1312, 800), 1024, 1024)).toThrow("changed the room framing");
  });
  it("retains full portrait and square source crops without stretching", () => {
    for (const [w, h] of [[800, 1312], [1024, 1024], [1328, 817]]) {
      if (!w || !h) throw new Error("Missing test dimensions");
      const f = eyeLevelFrame(w, h);
      expect(eyeLevelOutputBounds(f, f.canvasWidth, f.canvasHeight)).toMatchObject({ width: w, height: h });
    }
  });
  it("draws the crop-local camera direction at its actual room pixels", () => {
    const local = roomCropCamera({ position: { x: 40, y: 65 }, target: { x: 50, y: 40 } }, { x: 20, y: 30, width: 40, height: 50, room_name: "Living Room", room_type: "living_room" });
    const guide = cameraGuideGeometry(local, 1328, 817);
    expect(guide.position).toEqual({ x: 664, y: 571.9 });
    expect(guide.target).toEqual({ x: 996, y: 163.4 });
    expect(guide.left.x).toBeLessThan(guide.target.x);
    expect(guide.right.y).toBeGreaterThan(guide.target.y);
  });
});