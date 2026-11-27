import { describe, expect, it } from "vitest";
import {
  EMPTY_SCOPED_BRIEF,
  hasActiveCreativeBrief,
  resolveBriefAfterSourceChange,
  restoreScopedBrief,
} from "./aiRenderBrief";

const STALE_LIVING_ROOM_BRIEF = {
  roomType: "Living Room",
  styleDirection: "Mid-Century Modern",
  cameraAngles: "Eye-Level Perspective",
  briefNotes: "[Dimensions: W7 × D5 × H3]",
};

describe("aiRenderBrief", () => {
  it("drops legacy orphaned localStorage briefs that have no matching source-image binding", () => {
    const restored = restoreScopedBrief(
      {
        sourceImage: "https://example.com/residence-01-floorplan.png",
        activeBrief: STALE_LIVING_ROOM_BRIEF,
      },
      "https://example.com/residence-01-floorplan.png",
    );
    expect(restored).toEqual(EMPTY_SCOPED_BRIEF);
    expect(hasActiveCreativeBrief(restored.brief)).toBe(false);
  });

  it("drops a bound brief when the current source image is a different file", () => {
    const restored = restoreScopedBrief(
      {
        activeBrief: STALE_LIVING_ROOM_BRIEF,
        activeBriefSourceUrl: "https://example.com/old-ecart-request.png",
        activeBriefOrigin: "queue",
      },
      "https://example.com/residence-01-floorplan.png",
    );
    expect(restored).toEqual(EMPTY_SCOPED_BRIEF);
  });

  it("restores a queue brief when it is explicitly bound to the same source image", () => {
    const restored = restoreScopedBrief(
      {
        activeBrief: STALE_LIVING_ROOM_BRIEF,
        activeBriefSourceUrl: "https://example.com/request-1.png",
        activeBriefOrigin: "queue",
      },
      "https://example.com/request-1.png",
    );
    expect(restored).toEqual({
      brief: STALE_LIVING_ROOM_BRIEF,
      sourceUrl: "https://example.com/request-1.png",
      origin: "queue",
    });
  });

  it("clears a queue brief when a fresh source image is uploaded or reset", () => {
    const afterUpload = resolveBriefAfterSourceChange(
      {
        brief: STALE_LIVING_ROOM_BRIEF,
        sourceUrl: "https://example.com/old-request.png",
        origin: "queue",
      },
      "https://example.com/residence-01.png",
    );
    expect(afterUpload).toEqual(EMPTY_SCOPED_BRIEF);

    const afterClear = resolveBriefAfterSourceChange(
      {
        brief: STALE_LIVING_ROOM_BRIEF,
        sourceUrl: "https://example.com/old-request.png",
        origin: "queue",
      },
      null,
    );
    expect(afterClear).toEqual(EMPTY_SCOPED_BRIEF);
  });

  it("attaches an unbound Concierge brief to the first uploaded image, then clears it on a later replacement", () => {
    const attached = resolveBriefAfterSourceChange(
      {
        brief: { roomType: "Penthouse Great Room", briefNotes: "Warm limestone" },
        sourceUrl: null,
        origin: "concierge",
      },
      "https://example.com/residence-01.png",
    );
    expect(attached).toEqual({
      brief: { roomType: "Penthouse Great Room", briefNotes: "Warm limestone" },
      sourceUrl: "https://example.com/residence-01.png",
      origin: "concierge",
    });

    const replaced = resolveBriefAfterSourceChange(attached, "https://example.com/other-plan.png");
    expect(replaced).toEqual(EMPTY_SCOPED_BRIEF);
  });
});