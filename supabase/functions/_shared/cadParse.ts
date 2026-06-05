// Shared CAD parsing helpers for Phase 1.
// Goals: extract bbox + basic geometry from DXF and OBJ files.
// Other formats (DWG, FBX, SKP, …) are routed here too but return
// `unsupported` so callers can degrade gracefully.

import DxfParser from "https://esm.sh/dxf-parser@1.1.2";

export type Bbox = {
  w: number; // mm
  d: number; // mm
  h: number; // mm
  min: [number, number, number];
  max: [number, number, number];
};

export type Units = "mm" | "cm" | "m" | "in" | "ft" | "unknown";

export type ParsedGeometry = {
  bbox_mm: Bbox | null;
  units: Units;
  metrics: {
    vertex_count?: number;
    entity_count?: number;
    layer_count?: number;
    face_count?: number;
    rooms?: number;
  };
  rooms?: Array<{
    label: string | null;
    bbox_mm: Bbox;
    area_m2: number;
    polygon: Array<[number, number]>;
  }>;
};

export type ParseResult =
  | { ok: true; geometry: ParsedGeometry; format: string }
  | { ok: false; error: string; unsupported?: boolean };

// DXF $INSUNITS code → units
const DXF_INSUNITS: Record<number, Units> = {
  0: "unknown",
  1: "in",
  2: "ft",
  4: "mm",
  5: "cm",
  6: "m",
};

function unitToMm(value: number, units: Units): number {
  switch (units) {
    case "mm": return value;
    case "cm": return value * 10;
    case "m":  return value * 1000;
    case "in": return value * 25.4;
    case "ft": return value * 304.8;
    default:   return value; // assume mm fallback
  }
}

function emptyBbox(): { min: [number, number, number]; max: [number, number, number] } {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
}

function pushPoint(acc: { min: number[]; max: number[] }, x: number, y: number, z = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (x < acc.min[0]) acc.min[0] = x;
  if (y < acc.min[1]) acc.min[1] = y;
  if (z < acc.min[2]) acc.min[2] = z;
  if (x > acc.max[0]) acc.max[0] = x;
  if (y > acc.max[1]) acc.max[1] = y;
  if (z > acc.max[2]) acc.max[2] = z;
}

function finaliseBbox(
  acc: { min: number[]; max: number[] },
  units: Units,
): Bbox | null {
  if (!Number.isFinite(acc.min[0]) || !Number.isFinite(acc.max[0])) return null;
  const min: [number, number, number] = [
    unitToMm(acc.min[0], units),
    unitToMm(acc.min[1], units),
    unitToMm(acc.min[2] === Infinity ? 0 : acc.min[2], units),
  ];
  const max: [number, number, number] = [
    unitToMm(acc.max[0], units),
    unitToMm(acc.max[1], units),
    unitToMm(acc.max[2] === -Infinity ? 0 : acc.max[2], units),
  ];
  return {
    min,
    max,
    w: Math.round(max[0] - min[0]),
    d: Math.round(max[1] - min[1]),
    h: Math.round(max[2] - min[2]),
  };
}

// Shoelace area (drawing units²)
function polygonArea(points: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    a += (points[j][0] + points[i][0]) * (points[j][1] - points[i][1]);
  }
  return Math.abs(a) / 2;
}

function pointInPolygon(pt: [number, number], poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect =
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ---------------- DXF ----------------

export async function parseDxf(text: string): Promise<ParseResult> {
  let dxf: any;
  try {
    const parser = new (DxfParser as any)();
    dxf = parser.parseSync(text);
  } catch (e) {
    return { ok: false, error: `DXF parse failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!dxf?.entities) return { ok: false, error: "DXF contained no entities" };

  const insunits = dxf.header?.$INSUNITS ?? 0;
  const units: Units = DXF_INSUNITS[insunits] ?? "unknown";

  const acc = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let vertexCount = 0;
  const layers = new Set<string>();
  const closedPolylines: Array<{
    layer: string;
    points: Array<[number, number]>;
  }> = [];

  for (const ent of dxf.entities as any[]) {
    if (ent.layer) layers.add(ent.layer);
    const t = ent.type;
    if (t === "LINE") {
      pushPoint(acc, ent.vertices?.[0]?.x ?? ent.start?.x, ent.vertices?.[0]?.y ?? ent.start?.y, ent.vertices?.[0]?.z ?? 0);
      pushPoint(acc, ent.vertices?.[1]?.x ?? ent.end?.x, ent.vertices?.[1]?.y ?? ent.end?.y, ent.vertices?.[1]?.z ?? 0);
      vertexCount += 2;
    } else if (t === "LWPOLYLINE" || t === "POLYLINE") {
      const verts = ent.vertices || [];
      const pts: Array<[number, number]> = [];
      for (const v of verts) {
        pushPoint(acc, v.x, v.y, v.z ?? 0);
        pts.push([v.x, v.y]);
        vertexCount++;
      }
      if ((ent.shape || ent.closed) && pts.length >= 3) {
        closedPolylines.push({ layer: ent.layer || "", points: pts });
      }
    } else if (t === "CIRCLE" || t === "ARC") {
      const cx = ent.center?.x ?? 0, cy = ent.center?.y ?? 0, r = ent.radius ?? 0;
      pushPoint(acc, cx - r, cy - r);
      pushPoint(acc, cx + r, cy + r);
      vertexCount += 2;
    } else if (t === "POINT") {
      pushPoint(acc, ent.position?.x ?? 0, ent.position?.y ?? 0, ent.position?.z ?? 0);
      vertexCount++;
    } else if (t === "TEXT" || t === "MTEXT") {
      pushPoint(acc, ent.position?.x ?? ent.startPoint?.x ?? 0, ent.position?.y ?? ent.startPoint?.y ?? 0);
    } else if (t === "INSERT") {
      pushPoint(acc, ent.position?.x ?? 0, ent.position?.y ?? 0);
    }
  }

  const bbox = finaliseBbox(acc, units);

  // Detect rooms: closed polylines on layers matching ROOM|SPACE|A-AREA (case-insensitive)
  // Label rooms by intersecting TEXT/MTEXT entities.
  const roomLayerRe = /room|space|area|a-area|a_area/i;
  const candidateRooms = closedPolylines.filter((p) => roomLayerRe.test(p.layer));
  const rooms = (candidateRooms.length ? candidateRooms : closedPolylines).map((poly) => {
    const racc = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const [x, y] of poly.points) pushPoint(racc, x, y);
    const rbox = finaliseBbox(racc, units)!;
    const areaUnits = polygonArea(poly.points);
    // Convert area to m²
    const oneMm = unitToMm(1, units);
    const areaM2 = (areaUnits * oneMm * oneMm) / 1_000_000;
    // Find label
    let label: string | null = null;
    for (const ent of dxf.entities as any[]) {
      if (ent.type !== "TEXT" && ent.type !== "MTEXT") continue;
      const x = ent.position?.x ?? ent.startPoint?.x;
      const y = ent.position?.y ?? ent.startPoint?.y;
      if (typeof x !== "number" || typeof y !== "number") continue;
      if (pointInPolygon([x, y], poly.points)) {
        label = String(ent.text || ent.string || "").trim() || label;
        if (label) break;
      }
    }
    return { label, bbox_mm: rbox, area_m2: Math.round(areaM2 * 100) / 100, polygon: poly.points };
  })
    .filter((r) => r.area_m2 >= 1) // ignore noise
    .sort((a, b) => b.area_m2 - a.area_m2)
    .slice(0, 50);

  return {
    ok: true,
    format: "dxf",
    geometry: {
      bbox_mm: bbox,
      units,
      metrics: {
        vertex_count: vertexCount,
        entity_count: dxf.entities.length,
        layer_count: layers.size,
        rooms: rooms.length,
      },
      rooms,
    },
  };
}

// ---------------- OBJ ----------------

export function parseObj(text: string): ParseResult {
  const acc = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let vertexCount = 0;
  let faceCount = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine || rawLine[0] === "#") continue;
    if (rawLine.startsWith("v ")) {
      const parts = rawLine.split(/\s+/);
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      pushPoint(acc, x, y, z);
      vertexCount++;
    } else if (rawLine.startsWith("f ")) {
      faceCount++;
    }
  }
  // OBJ is unitless by convention. Most product exports are mm.
  const units: Units = "mm";
  const bbox = finaliseBbox(acc, units);
  if (!bbox) return { ok: false, error: "OBJ contained no vertices" };
  return {
    ok: true,
    format: "obj",
    geometry: {
      bbox_mm: bbox,
      units,
      metrics: { vertex_count: vertexCount, face_count: faceCount },
    },
  };
}

// ---------------- Router ----------------

export async function parseCadFile(
  bytes: ArrayBuffer,
  format: string,
): Promise<ParseResult> {
  const fmt = format.toLowerCase();
  if (fmt === "dxf") {
    const text = new TextDecoder().decode(bytes);
    return await parseDxf(text);
  }
  if (fmt === "obj") {
    const text = new TextDecoder().decode(bytes);
    return parseObj(text);
  }
  return {
    ok: false,
    unsupported: true,
    error: `Format .${fmt} is not supported in Phase 1. Falls back to the product's declared dimensions.`,
  };
}

// ---------------- Fit checker ----------------

export type FitVerdict = "pass" | "warn" | "fail" | "unknown";

export type FitReason = {
  code: string;
  severity: "info" | "warn" | "error";
  message: string;
  detail?: Record<string, unknown>;
};

export function checkBboxFit(
  product: Bbox | null,
  room: Bbox | null,
  clearanceMm = 0,
): { verdict: FitVerdict; reasons: FitReason[] } {
  if (!product || !room) {
    return {
      verdict: "unknown",
      reasons: [{ code: "missing_bbox", severity: "warn", message: "Missing geometry on product or room." }],
    };
  }
  const reasons: FitReason[] = [];
  const pw = product.w, pd = product.d, ph = product.h;
  // Room footprint = w × d on the floor plane
  const rw = room.w, rd = room.d;
  const needW = pw + clearanceMm * 2;
  const needD = pd + clearanceMm * 2;

  let verdict: FitVerdict = "pass";

  // Both orientations
  const fitsAxis = (needW <= rw && needD <= rd);
  const fitsRot  = (needW <= rd && needD <= rw);
  if (!fitsAxis && !fitsRot) {
    reasons.push({
      code: "footprint_too_large",
      severity: "error",
      message: `Footprint ${pw}×${pd}mm does not fit room ${rw}×${rd}mm even with rotation.`,
      detail: { product: { w: pw, d: pd }, room: { w: rw, d: rd }, clearance_mm: clearanceMm },
    });
    verdict = "fail";
  } else if (!fitsAxis) {
    reasons.push({
      code: "rotation_required",
      severity: "info",
      message: "Fits only when rotated 90°.",
    });
  }
  // Clearance warning if either side <600mm of slack
  const slackW = Math.max(0, Math.max(rw, rd) - Math.max(pw, pd));
  const slackD = Math.max(0, Math.min(rw, rd) - Math.min(pw, pd));
  if (verdict !== "fail" && (slackW < 600 || slackD < 600)) {
    reasons.push({
      code: "tight_clearance",
      severity: "warn",
      message: `Tight clearance: only ${Math.min(slackW, slackD)}mm of slack on one side. Circulation typically wants ≥600mm.`,
    });
    if (verdict === "pass") verdict = "warn";
  }

  if (ph && room.h && ph > room.h) {
    reasons.push({
      code: "height_exceeds_ceiling",
      severity: "error",
      message: `Product height ${ph}mm exceeds room/ceiling height ${room.h}mm.`,
    });
    verdict = "fail";
  }

  if (reasons.length === 0) {
    reasons.push({ code: "fits_cleanly", severity: "info", message: "Fits with comfortable clearance." });
  }

  return { verdict, reasons };
}
