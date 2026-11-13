/** Clear only import repair; intentional placement and sizing must survive. */
export function resetModelOrientation<T extends { modelOrientation?: unknown }>(object: T): T {
  return { ...object, modelOrientation: undefined };
}