/**
 * Lightweight client-side GLB/GLTF inspector.
 *
 * We only need material / mesh names to validate the "fabric convention"
 * expected by <Product3DViewer />. This avoids pulling a full glTF loader
 * into the admin bundle.
 */

const UPHOLSTERY_KEYWORDS = [
  "fabric",
  "upholstery",
  "cushion",
  "seat",
  "cover",
  "textile",
  "pillow",
  "sofa",
];

export interface GlbInspectResult {
  materialNames: string[];
  meshNames: string[];
  matchedNames: string[];
  hasUpholsteryConvention: boolean;
  parseError?: string;
}

function extractJsonChunk(buf: ArrayBuffer): any {
  const dv = new DataView(buf);
  // Header: 'glTF' (0x46546C67 LE), version, total length
  const magic = dv.getUint32(0, true);
  if (magic !== 0x46546c67) {
    // Not a binary GLB — try to parse as JSON glTF.
    const txt = new TextDecoder().decode(buf);
    return JSON.parse(txt);
  }
  const jsonLen = dv.getUint32(12, true);
  const jsonType = dv.getUint32(16, true); // 0x4E4F534A = 'JSON'
  if (jsonType !== 0x4e4f534a) {
    throw new Error("First chunk is not JSON");
  }
  const jsonBytes = new Uint8Array(buf, 20, jsonLen);
  return JSON.parse(new TextDecoder().decode(jsonBytes));
}

export async function inspectGlbFile(file: File): Promise<GlbInspectResult> {
  try {
    const buf = await file.arrayBuffer();
    const gltf = extractJsonChunk(buf);
    const materialNames: string[] = Array.isArray(gltf.materials)
      ? gltf.materials.map((m: any) => String(m?.name || "")).filter(Boolean)
      : [];
    const meshNames: string[] = Array.isArray(gltf.meshes)
      ? gltf.meshes.map((m: any) => String(m?.name || "")).filter(Boolean)
      : [];
    const candidates = [...materialNames, ...meshNames];
    const matchedNames = candidates.filter((n) => {
      const lower = n.toLowerCase();
      return UPHOLSTERY_KEYWORDS.some((k) => lower.includes(k));
    });
    return {
      materialNames,
      meshNames,
      matchedNames,
      hasUpholsteryConvention: matchedNames.length > 0,
    };
  } catch (e: any) {
    return {
      materialNames: [],
      meshNames: [],
      matchedNames: [],
      hasUpholsteryConvention: false,
      parseError: e?.message || String(e),
    };
  }
}

export { UPHOLSTERY_KEYWORDS };
