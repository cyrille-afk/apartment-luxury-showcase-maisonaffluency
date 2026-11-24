type Role = "base" | "top" | "ignore";
// Audited supplier exports: indices 0–3 are oak; the last two are travertine.
// These exact file revisions have no material names. Never apply to other exports.
const riftFiles: Record<string, number> = {
  "w-108-d-108-h-28-cm-1793853908872.glb": 7,
  "w-128-d-128-h-28-cm---bleached-oak-or-smoked-1793877869830.glb": 7,
  "w-148-d-148-h-28-cm---bleached-oak-or-smoked-1793877899696.glb": 6,
  "w-168-d-88-h-28-cm---bleached-oak-or-smoked-1793877910846.glb": 7,
};
export function editorialUnnamedMaterialRole(url: string, index: number, count: number): Role | null {
  const expected = riftFiles[url.split("?")[0]?.split("/").pop() ?? ""];
  if (!expected || expected !== count || index < 0 || index >= count) return null;
  return index < 4 ? "base" : index >= count - 2 ? "top" : "ignore";
}