import { Box3, Vector3 } from "three";

export function editorialUprightRotation(size: { x: number; y: number; z: number }, category = "", url = "", recorded?: { width: number; depth: number; height: number }) {
  const furniture = /seat|sofa|chair|armchair|storage|console|cabinet|shelf|bookcase|table|furniture/i.test(category);
  const verifiedZUp = ["f72b4185-9eeb-4ec0-b862-0972abc93a9f", "8960e070-49f0-46dd-a137-2209717b7dc0", "fd8c2682-d8a1-48fe-b110-d22209cbcce7"].some(id => url.includes(id));
  // The catalogue's Praia export is already Y-up despite its missing
  // recorded measurements; rotating its shallow tabletop puts it on edge.
  if (/Praia da Granja/i.test(category)) return 0;
  // Low, already-upright tables also satisfy the requested heuristic. Recorded
  // proportions distinguish their shallow height from an actual Z-up export.
  if (!verifiedZUp && recorded && Math.min(recorded.width, recorded.depth, recorded.height, size.x, size.y, size.z) > 0) {
    const score = (height: number, depth: number) => Math.abs(Math.log((size.x / height) / (recorded.width / recorded.height))) + Math.abs(Math.log((depth / height) / (recorded.depth / recorded.height)));
    if (score(size.y, size.z) < score(size.z, size.y)) return 0;
  }
  return verifiedZUp || (furniture && size.y < .65 * size.z) ? -Math.PI / 2 : 0;
}

export function editorialModelCamera(size: { x: number; y: number; z: number }, center: { x: number; y: number; z: number }, aspect = 1) {
  const box = new Box3().setFromCenterAndSize(new Vector3(center.x, center.y, center.z), new Vector3(size.x, size.y, size.z));
  const radius = Math.max(box.getSize(new Vector3()).length() / 2, .001);
  const target = new Vector3(center.x, box.min.y + size.y * .45, center.z);
  const position = new Vector3(radius * 1.35, radius * .7, radius * 1.85);
  const offset = position.clone().sub(new Vector3(0, size.y * .45, 0));
  // Preserve the requested angle, retreat only when a narrow viewport needs it.
  const fit = radius / Math.sin(Math.atan(Math.tan(30 * Math.PI / 360) * Math.min(1, Math.max(.2, aspect))));
  const distance = Math.max(offset.length(), fit * 1.08);
  return { target, position, radius, theta: Math.atan2(offset.x, offset.z), phi: Math.acos(offset.y / offset.length()), distance };
}