import { assert, assertFalse } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  AXO_CUTAWAY_CAMERA_GUARD,
  buildAxoStyleText,
  buildSkipStyleReferenceClause,
  getAxoStyleProfile,
} from "./axonometricPrompt.ts";

Deno.test("elevation_to_axo strips Eye-Level Perspective camera angle and interior-photography preset text", () => {
  const style = "luxurious editorial interior photography style with dramatic lighting and rich textures";
  const styleProfile = getAxoStyleProfile(style, true);
  const text = buildAxoStyleText({
    mode: "elevation_to_axo",
    style,
    styleProfile,
    hasLockedReference: false,
    brief: {
      roomType: "Living Room",
      styleDirection: "Mid-Century Modern",
      cameraAngles: "Eye-Level Perspective",
      briefNotes: "[Dimensions: W7 × D5 × H3]",
    },
  });

  assertFalse(text.includes("Eye-Level Perspective"), "Eye-Level Perspective must never enter elevation_to_axo prompt");
  assertFalse(text.includes("Preferred camera angles"), "cameraAngles override must not enter elevation_to_axo prompt");
  assertFalse(text.includes("interior photography"), "interior photography wording must not enter elevation_to_axo prompt");
  assert(text.includes("NEVER omit other rooms"), "roomType must be explicitly subordinate to the uploaded drawing");
  assert(text.includes("NEVER override room count, dimensions, footprint"), "briefNotes must not override plan dimensions");
});

Deno.test("section_to_axo also blocks cameraAngles override and keeps elevated cutaway camera on skipStyleReference", () => {
  const styleProfile = getAxoStyleProfile("Editorial Luxury", true);
  const text = buildAxoStyleText({
    mode: "section_to_axo",
    style: "Editorial Luxury",
    styleProfile,
    hasLockedReference: false,
    brief: { cameraAngles: "Eye-Level Perspective" },
  });
  assertFalse(text.includes("Eye-Level Perspective"));

  const skipClause = buildSkipStyleReferenceClause("section_to_axo");
  assertFalse(skipClause.includes("Choose your own optimal camera angle"));
  assert(skipClause.includes("NEVER switch to an eye-level interior perspective"));
});

Deno.test("AXO_CUTAWAY_CAMERA_GUARD explicitly forbids eye-level shots and floor-plan mini-map insets", () => {
  assert(AXO_CUTAWAY_CAMERA_GUARD.includes("NEVER render an eye-level interior perspective"));
  assert(AXO_CUTAWAY_CAMERA_GUARD.includes("NEVER place a 2D floor-plan inset, mini-map"));
});