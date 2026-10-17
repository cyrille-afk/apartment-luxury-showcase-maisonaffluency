/** Uploaded interiors are visible surroundings, regardless of renderer mode. */
export function uploadedEnvironmentPresentation(uploaded: boolean, pathTrace: boolean) {
  return {
    background: uploaded || pathTrace,
    blur: uploaded ? 0 : pathTrace ? 0.85 : 0,
  };
}