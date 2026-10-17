import { describe, expect, it } from "vitest";
import { mockupCapturePrep } from "@/lib/visualiserExport";

describe("mockupCapturePrep", () => {
  it("Photoreal export leaves grid and selection untouched so accumulated SPP survives", () => {
    expect(mockupCapturePrep(true, true, "piece-1")).toEqual({ hideGrid: false, clearSelection: false });
  });

  it("live export still hides the grid and the selected piece's gizmo", () => {
    expect(mockupCapturePrep(false, true, "piece-1")).toEqual({ hideGrid: true, clearSelection: true });
  });
});
