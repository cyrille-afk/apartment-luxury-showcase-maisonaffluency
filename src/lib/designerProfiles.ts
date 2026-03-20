/**
 * Aggregates designer profile data from FeaturedDesigners and Collectibles
 * for use on individual designer profile pages.
 */
import { featuredDesigners, type CuratorPick } from "@/components/FeaturedDesigners";
import { collectibleDesigners } from "@/components/Collectibles";

export interface DesignerProfile {
  id: string;
  slug: string;
  name: string;
  specialty: string;
  image: string;
  biography: string;
  notableWorks: string;
  philosophy: string;
  curatorPicks: CuratorPick[];
  links: { type: string; url?: string }[];
  logoUrl?: string;
  source: "featured" | "collectible";
}

function toSlug(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

let _cached: DesignerProfile[] | null = null;

export function getAllDesignerProfiles(): DesignerProfile[] {
  if (_cached) return _cached;

  const profiles: DesignerProfile[] = [];
  const seen = new Set<string>();

  for (const d of featuredDesigners) {
    const id = d.id || d.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (seen.has(id)) continue;
    seen.add(id);
    profiles.push({
      id,
      slug: toSlug(id),
      name: d.name,
      specialty: d.specialty || "",
      image: d.image,
      biography: d.biography || "",
      notableWorks: d.notableWorks || "",
      philosophy: d.philosophy || "",
      curatorPicks: d.curatorPicks || [],
      links: d.links || [],
      logoUrl: d.logoUrl,
      source: "featured",
    });
  }

  for (const d of collectibleDesigners) {
    const id = d.id || d.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (seen.has(id)) continue;
    seen.add(id);
    profiles.push({
      id,
      slug: toSlug(id),
      name: d.name,
      specialty: d.specialty || "",
      image: d.image,
      biography: d.biography || "",
      notableWorks: d.notableWorks || "",
      philosophy: d.philosophy || "",
      curatorPicks: d.curatorPicks || [],
      links: d.links || [],
      source: "collectible",
    });
  }

  _cached = profiles;
  return profiles;
}

export function getDesignerBySlug(slug: string): DesignerProfile | undefined {
  return getAllDesignerProfiles().find((d) => d.slug === slug);
}
