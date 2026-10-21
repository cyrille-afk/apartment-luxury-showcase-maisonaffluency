import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

describe("industrial room reset", () => {
  it("clears the environment and backdrop without changing furniture or remount keys", async () => {
    // Exercise the actual page handler without mounting the WebGL workspace.
    const source = readFileSync("src/pages/TradeVisualiser.tsx", "utf8");
    const body = source.match(/const resetIndustrialRoom = async \(\) => \{([\s\S]*?)\n  \};/)?.[1];
    if (!body) throw new Error("Industrial reset handler not found");
    const clearLocalExr = vi.fn().mockResolvedValue(undefined);
    const setEnvironmentSource = vi.fn();
    const setPhotoCalibration = vi.fn();
    const setBackdrop = vi.fn();
    const setBackdropDataUrl = vi.fn();
    const setObjects = vi.fn();
    const setCanvasEpoch = vi.fn();
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;
    const reset = new AsyncFunction("clearLocalExr", "setEnvironmentSource", "setPhotoCalibration", "setBackdrop", "setBackdropDataUrl", "setObjects", "setCanvasEpoch", "toast", body);

    await reset(clearLocalExr, setEnvironmentSource, setPhotoCalibration, setBackdrop, setBackdropDataUrl, setObjects, setCanvasEpoch, { success: vi.fn() });

    expect(clearLocalExr).toHaveBeenCalledOnce();
    expect(setEnvironmentSource).toHaveBeenCalledExactlyOnceWith("studio-hdr");
    expect(setPhotoCalibration).toHaveBeenCalledExactlyOnceWith(null);
    expect(setBackdrop).toHaveBeenCalledExactlyOnceWith(null);
    expect(setBackdropDataUrl).toHaveBeenCalledExactlyOnceWith(null);
    expect(setObjects).not.toHaveBeenCalled();
    expect(setCanvasEpoch).not.toHaveBeenCalled();
  });
});