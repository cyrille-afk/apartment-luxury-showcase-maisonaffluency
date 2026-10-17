/**
 * Uploaded interiors light the scene; the visible surround is the fitted flat
 * backdrop (UploadedEnvironmentBackdrop), never the 360° projection — a
 * panoramic scene.background only ever shows a zoomed slice and its floor
 * line never meets the furniture ground plane.
 */
export function uploadedEnvironmentPresentation(uploaded: boolean, pathTrace: boolean) {
  return {
    background: uploaded ? false : pathTrace,
    blur: pathTrace ? 0.85 : 0,
  };
}