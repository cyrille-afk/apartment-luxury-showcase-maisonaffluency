/** Metres, in rendered X/Y/Z order. No catalogue prices or automatic repairs. */
export type ArDimensions = [number, number, number];
export type ArValidationIssue = { code: string; severity: "error" | "review"; message: string };
export type ArValidationInput = {
  dimensions: ArDimensions;
  vertices: number;
  expected?: ArDimensions;
  /** Audited source-up vector after the viewer's export rotation. */
  exportedUp?: ArDimensions;
};

export function validateArExport(input: ArValidationInput): ArValidationIssue[] {
  const issues: ArValidationIssue[] = [];
  const add = (code: string, severity: ArValidationIssue["severity"], message: string) => issues.push({ code, severity, message });
  if (!Number.isFinite(input.vertices) || input.vertices < 3 || input.dimensions.some(value => !Number.isFinite(value) || value <= 0)) {
    add("invalid-geometry", "error", "The export has missing, empty or invalid geometry.");
    return issues;
  }
  // Broad furniture bounds, not category-specific invented specifications.
  if (Math.max(...input.dimensions) > 10 || Math.max(...input.dimensions) < .05) {
    add("unrealistic-dimensions", "error", "Export dimensions are outside 5cm–10m; check source units and export scale.");
  }
  if (input.expected && input.expected.every(value => Number.isFinite(value) && value > 0)) {
    const matches = (dimensions: ArDimensions) => dimensions.every((value, i) => {
      const reference = input.expected?.[i];
      return reference !== undefined && Math.abs(value - reference) <= Math.max(.05, reference * .2);
    });
    if (!matches(input.dimensions)) {
      const [x, y, z] = input.dimensions;
      const permuted = [[y, x, z], [x, z, y], [z, y, x], [z, x, y], [y, z, x]] as ArDimensions[];
      add(permuted.some(matches) ? "orientation-mismatch" : "dimension-mismatch", "error",
        permuted.some(matches) ? "The model's vertical axis disagrees with its recorded dimensions; review upright orientation." : "Export size disagrees with its recorded dimensions by more than 20% or 5cm.");
    }
  } else {
    add("dimensions-unconfirmed", "review", "No complete recorded measurements; true scale needs review.");
  }
  if (input.exportedUp) {
    const [x, y, z] = input.exportedUp;
    const length = Math.hypot(x, y, z);
    if (!Number.isFinite(length) || length < .001 || y / length < .98) {
      add("not-upright", "error", "The audited up direction is sideways or inverted after AR export.");
    }
  } else {
    add("orientation-unconfirmed", "review", "No audited up direction; dimensions alone cannot prove the piece stands upright.");
  }
  return issues;
}