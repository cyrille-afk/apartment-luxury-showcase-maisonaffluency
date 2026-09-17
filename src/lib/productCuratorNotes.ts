export interface CuratorNotesSource {
  title: string;
  brandName: string;
  description?: string | null;
  dimensions?: string | null;
  category?: string | null;
  subcategory?: string | null;
}

export interface ProductCuratorNotes {
  significance: string;
  spatial: string;
  provenance: string;
}

export function buildProductCuratorNotes(source: CuratorNotesSource): ProductCuratorNotes {
  const designer = source.brandName.includes(" - ")
    ? source.brandName.split(" - ")[0].trim()
    : source.brandName;
  const year = source.title.match(/\b(18|19|20)\d{2}\b/)?.[0] || null;
  const plainDescription = (source.description || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = plainDescription.match(/[^.!?]+[.!?]+/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [];
  const category = (source.subcategory || source.category || "piece").toLowerCase();
  const dimensions = (source.dimensions || "").split("\n")[0]?.trim();

  return {
    significance:
      sentences[0] ||
      (year
        ? `A definitive ${year} ${category} in understated elegance, capturing the transition from historic craft to refined modern minimalism.`
        : `A definitive ${category} in understated elegance, capturing the transition from historic craft to refined modern minimalism.`),
    spatial:
      sentences[1] ||
      (dimensions
        ? `Proportioned at ${dimensions}, with precise geometric balance to serve as a quiet, functional focal point for considered interiors.`
        : "A stripped-back silhouette with precise geometric proportions, calculated to serve as a quiet, functional focal point for considered interiors."),
    provenance:
      sentences[2] ||
      `Reflects ${designer}’s design philosophy, balancing refined craftsmanship with enduring architectural clarity.`,
  };
}