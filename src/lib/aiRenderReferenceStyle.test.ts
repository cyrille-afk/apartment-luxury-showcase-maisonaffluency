import { describe, expect, it } from "vitest";
import {
  DEFAULT_USE_LOCKED_REF_STYLE,
  resolveStyleReferencePayload,
  type SavedReferenceStyle,
} from "./aiRenderReferenceStyle";

const SAVED_STYLES: SavedReferenceStyle[] = [
  {
    id: "ref-section",
    mode: "section_to_axo",
    image_url: "https://example.com/old-ecart-style.png",
    updated_at: "2026-04-11T04:51:39.015Z",
  },
];

const passthrough = (url: string | null | undefined) => url ?? null;

describe("aiRenderReferenceStyle", () => {
  it("defaults locked reference styles to OFF so fresh floor plans never inherit an old render", () => {
    expect(DEFAULT_USE_LOCKED_REF_STYLE).toBe(false);

    const payload = resolveStyleReferencePayload({
      mode: "section_to_axo",
      referenceStyles: SAVED_STYLES,
      useLockedRefStyle: DEFAULT_USE_LOCKED_REF_STYLE,
      toAbsoluteUrl: passthrough,
    });

    expect(payload).toEqual({
      styleReferenceUrl: undefined,
      skipStyleReference: true,
    });
  });

  it("sends styleReferenceUrl only when the admin explicitly turns the saved style ON", () => {
    const payload = resolveStyleReferencePayload({
      mode: "section_to_axo",
      referenceStyles: SAVED_STYLES,
      useLockedRefStyle: true,
      toAbsoluteUrl: passthrough,
    });

    expect(payload).toEqual({
      styleReferenceUrl: "https://example.com/old-ecart-style.png",
      skipStyleReference: false,
    });
  });

  it("omits both style flags when no saved reference style exists for the mode", () => {
    const payload = resolveStyleReferencePayload({
      mode: "elevation_to_axo",
      referenceStyles: SAVED_STYLES,
      useLockedRefStyle: true,
      toAbsoluteUrl: passthrough,
    });

    expect(payload).toEqual({
      styleReferenceUrl: undefined,
      skipStyleReference: false,
    });
  });
});