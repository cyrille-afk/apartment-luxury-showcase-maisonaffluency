import { describe, expect, it } from "vitest";
import { checkpointStatusText } from "@/lib/visualiserRenderCheckpoint";

const savedAt = new Date(2026, 9, 17, 12, 30, 15).getTime();

describe("checkpointStatusText", () => {
  it("shows restored SPP and the checkpoint save time after a refresh", () => {
    const text = checkpointStatusText({ kind: "restored", samples: 2500, savedAt }, "en-GB");
    expect(text).toBe("Restored 2500 SPP · checkpoint saved 12:30:15");
  });
  it("shows the latest saved checkpoint time", () => {
    expect(checkpointStatusText({ kind: "saved", samples: 2600, savedAt }, "en-GB")).toBe("Checkpoint saved 12:30:15 · 2600 SPP");
  });
  it("shows nothing before any checkpoint event", () => {
    expect(checkpointStatusText(null)).toBeNull();
  });
});
