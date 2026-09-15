/**
 * Canonical fabric/finish categories shared by the Admin Fabrics table and the
 * user-facing Material Library. Stored `fabrics.category` values are free text
 * ("velvet", "leather", "rug"…), so both surfaces must normalize before
 * filtering or labelling — otherwise category pills hide valid materials.
 */
export type FabricCategory =
  | "Fabric & Leather"
  | "Rug Finish"
  | "Wood"
  | "Stone"
  | "Metal"
  | "Glass"
  | "Other";

export const FABRIC_CATEGORIES: FabricCategory[] = [
  "Fabric & Leather",
  "Rug Finish",
  "Wood",
  "Stone",
  "Metal",
  "Glass",
  "Other",
];

export const normalizeFabricCategory = (category: string | null | undefined): FabricCategory => {
  const raw = (category || "").trim().toLowerCase();
  if (["rug finish", "rug finishes", "rug"].includes(raw)) return "Rug Finish";
  if ([
    "fabric", "fabrics", "upholstery", "leather", "fabric & leather", "fabric/leather",
    "shearling", "sheepskin", "suede", "nubuck", "hide", "textile", "velvet",
    "boucle", "bouclé", "linen", "wool", "silk", "mohair", "cotton",
  ].includes(raw)) return "Fabric & Leather";
  if (["wood", "woods", "timber", "rattan", "cane", "wicker"].includes(raw)) return "Wood";
  if (raw === "stone") return "Stone";
  if (raw === "metal") return "Metal";
  if (raw === "glass") return "Glass";
  return "Other";
};
