export interface AxoStyleProfile {
  key: string;
  label: string;
  renderInstructions: string;
  lockedReferenceBehavior: string;
  matchedNamedPreset: boolean;
}

export interface AxoBriefFields {
  roomType?: string;
  styleDirection?: string;
  lightingMood?: string;
  renderEngine?: string;
  cameraAngles?: string;
  briefNotes?: string;
}

export const isAxoExtrusionMode = (mode: string): boolean =>
  mode === "elevation_to_axo" || mode === "section_to_axo";

const normalizeText = (value?: string) => (value || "").trim().toLowerCase();

export function getAxoStyleProfile(rawStyle?: string, axoExtrusion = false): AxoStyleProfile {
  const normalized = normalizeText(rawStyle);

  if (normalized.includes("editorial")) {
    return {
      key: "editorial_luxury",
      label: "Editorial Luxury",
      matchedNamedPreset: true,
      renderInstructions: axoExtrusion
        ? "Finish the 3D axonometric cutaway model with luxury architectural-visualization grading: sculptural natural light, richer contrast, crisp reflections on stone/metal/glass, warmer highlights, and clean shadow separation while keeping the elevated cutaway viewpoint."
        : "Create a high-fashion luxury interiors image with sculptural light, richer contrast, deeper shadow separation that still preserves detail, brighter specular highlights on stone/metal/glass, warmer highlights, cleaner blacks, and a premium magazine-grade finish. This must feel dramatic, glamorous, and intentionally art-directed rather than neutral.",
      lockedReferenceBehavior:
        "After matching the reference render exactly, apply ONLY a finishing pass of editorial grading: slightly deeper blacks, richer contrast, crisper reflections, and more sculptural highlight roll-off. Do NOT change the reference lighting direction, exposure balance, warmth, or shadow pattern.",
    };
  }

  if (normalized.includes("watercolor")) {
    return {
      key: "watercolor",
      label: "Watercolor",
      matchedNamedPreset: true,
      renderInstructions:
        "Create an elegant watercolor architectural illustration with soft pigment washes, visible paper softness, restrained edge definition, fine architectural linework, and delicate tonal transitions.",
      lockedReferenceBehavior:
        "Preserve the reference composition and lighting structure, but reinterpret the final finish as a refined watercolor wash without changing the underlying light placement or geometry.",
    };
  }

  if (normalized.includes("minimal")) {
    return {
      key: "minimal_line",
      label: "Minimal Line",
      matchedNamedPreset: true,
      renderInstructions:
        "Create a pared-back architectural image with restrained tones, clean line emphasis, soft neutral shadows, simplified material expression, and a calm gallery-like presentation.",
      lockedReferenceBehavior:
        "Preserve the reference lighting structure and geometry, then simplify the finish into a cleaner, quieter, more minimal presentation without re-lighting the image.",
    };
  }

  if (normalized.includes("scandinavian")) {
    return {
      key: "scandinavian",
      label: "Scandinavian",
      matchedNamedPreset: true,
      renderInstructions:
        "Create a Scandinavian architectural visualization with airy daylight, pale timber, soft diffuse reflections, understated contrast, light tactile materials, and a serene residential atmosphere.",
      lockedReferenceBehavior:
        "Keep the exact reference lighting structure intact, but finish the image with a lighter Scandinavian tonality and softer material palette cues only where they do not contradict the locked reference.",
    };
  }

  return {
    key: "photorealistic",
    label: "Photorealistic",
    matchedNamedPreset: normalized.includes("photoreal"),
    renderInstructions: axoExtrusion
      ? "Finish the 3D axonometric cutaway model with neutral high-end archviz lighting: balanced exposure, true-to-material color, realistic daylight roll-off, natural highlight behavior, readable shadow detail, and minimal grading."
      : "Create a neutral high-end archviz image with balanced exposure, true-to-material color, realistic daylight roll-off, natural highlight behavior, readable shadow detail, and minimal grading. This must feel like a premium real photograph of the finished interior rather than a stylized editorial shoot.",
    lockedReferenceBehavior:
      "After matching the reference render exactly, keep the finish neutral and documentary: balanced exposure, accurate material color, restrained grading, and no exaggerated contrast or fashion-editorial treatment.",
  };
}

export function buildAxoStyleText(input: {
  mode: string;
  style?: string;
  styleProfile: AxoStyleProfile;
  hasLockedReference: boolean;
  brief: AxoBriefFields;
}): string {
  const axoExtrusion = isAxoExtrusionMode(input.mode);
  const { brief, styleProfile, hasLockedReference, style } = input;
  const parts: string[] = [
    `Primary style preset: ${styleProfile.label}. ${styleProfile.renderInstructions}`,
  ];

  if (style && !styleProfile.matchedNamedPreset && normalizeText(style) !== normalizeText(styleProfile.label)) {
    parts.push(`Preset source text: ${style}`);
  }
  if (brief.styleDirection) {
    parts.push(`Project style direction (palette & materials only, secondary to the preset): ${brief.styleDirection}`);
  }
  if (brief.lightingMood) {
    parts.push(
      `Lighting mood request (secondary to the preset${hasLockedReference ? " and never allowed to override the locked reference lighting" : ""}): ${brief.lightingMood}`,
    );
  }
  if (brief.roomType) {
    parts.push(
      axoExtrusion
        ? `Finish styling context: ${brief.roomType} (styling cue ONLY — NEVER omit other rooms or alter the multi-room layout shown in the uploaded drawing)`
        : `Room type: ${brief.roomType}`,
    );
  }
  if (brief.renderEngine && brief.renderEngine !== "no_preference") {
    const engineLabel =
      brief.renderEngine === "corona"
        ? "Corona Renderer"
        : brief.renderEngine === "vray"
          ? "V-Ray"
          : brief.renderEngine;
    parts.push(`Render engine aesthetic: ${engineLabel} (match its characteristic look — GI, tone-mapping, material response)`);
  }
  // NEVER allow a creative brief camera angle (e.g. "Eye-Level Perspective") to
  // override the elevated 3D axonometric cutaway camera in elevation/section modes.
  if (brief.cameraAngles && !axoExtrusion) {
    parts.push(`Preferred camera angles: ${brief.cameraAngles}`);
  }
  if (brief.briefNotes) {
    parts.push(
      axoExtrusion
        ? `Secondary finish notes (material/mood hints ONLY — NEVER override room count, dimensions, footprint, or wall positions from the uploaded drawing): ${brief.briefNotes}`
        : `Additional notes: ${brief.briefNotes}`,
    );
  }
  return parts.join(". ");
}

export function buildSkipStyleReferenceClause(mode: string): string {
  if (isAxoExtrusionMode(mode)) {
    return `\n\nIMPORTANT: Generate a FRESH, original 3D axonometric cutaway extrusion strictly matching the uploaded drawing's exact perimeter, walls, rooms, openings, and furniture layout. Keep the elevated bird's-eye axonometric cutaway camera — NEVER switch to an eye-level interior perspective or invent a different room.`;
  }
  return `\n\nIMPORTANT: Generate a FRESH, original interpretation of this drawing. Choose your own color palette and lighting setup while strictly preserving the uploaded drawing's geometry.`;
}

export const AXO_CUTAWAY_CAMERA_GUARD = `\n\nMANDATORY VIEWPOINT & COMPOSITION (NON-NEGOTIABLE — VIOLATING THIS MEANS TOTAL FAILURE):
- Render the ENTIRE uploaded drawing as ONE continuous 3D open-top cutaway architectural model viewed from an elevated oblique bird's-eye angle (≈45° azimuth, 35°–45° elevation), showing EVERY room, corridor, balcony/terrace, and partition wall simultaneously.
- ABSOLUTELY FORBIDDEN: NEVER render an eye-level interior perspective photograph or zoom into a single room.
- ABSOLUTELY FORBIDDEN: NEVER place a 2D floor-plan inset, mini-map, picture-in-picture overlay, or split-screen graphic anywhere in the output.
- STRIP ALL 2D SHEET ANNOTATIONS: Ignore and remove all printed text, room names, square-footage legends, dimension numbers, scale bars, and north arrows from the uploaded drawing — extrude ONLY the physical architecture, balconies/terraces, doors/windows, and furniture layout.`;