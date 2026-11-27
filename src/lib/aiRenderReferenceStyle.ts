export interface SavedReferenceStyle {
  id: string;
  mode: string;
  image_url: string;
  updated_at: string;
}

/**
 * Saved reference styles are strictly opt-in so a previous render never silently
 * hijacks a fresh floor plan or section generation.
 */
export const DEFAULT_USE_LOCKED_REF_STYLE = false;

export function findReferenceStyleForMode(
  referenceStyles: readonly SavedReferenceStyle[] | undefined,
  mode: string,
): SavedReferenceStyle | undefined {
  return referenceStyles?.find((r) => r.mode === mode);
}

export function resolveStyleReferencePayload(input: {
  mode: string;
  referenceStyles: readonly SavedReferenceStyle[] | undefined;
  useLockedRefStyle: boolean;
  toAbsoluteUrl: (url: string | null | undefined) => string | null;
}): {
  styleReferenceUrl: string | undefined;
  skipStyleReference: boolean;
} {
  const refStyle = findReferenceStyleForMode(input.referenceStyles, input.mode);
  if (!refStyle) {
    return { styleReferenceUrl: undefined, skipStyleReference: false };
  }
  if (!input.useLockedRefStyle) {
    return { styleReferenceUrl: undefined, skipStyleReference: true };
  }
  const absoluteUrl = input.toAbsoluteUrl(refStyle.image_url);
  return {
    styleReferenceUrl: absoluteUrl || undefined,
    skipStyleReference: !absoluteUrl,
  };
}