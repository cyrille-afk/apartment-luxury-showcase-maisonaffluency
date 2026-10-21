import { absoluteUrl } from "@/config/site";
import { toOgImage } from "@/lib/ogImage";
import emmaHero from "@/assets/og/emma-donnersberg-hero-og.jpg.asset.json";

export interface DesignerOpenGraphInput {
  slug: string;
  name: string;
  description: string;
  heroImage?: string | null;
}

// WhatsApp: keep the authentic Emma hero rendition at 1200×630, JPEG and
// strictly below 300,000 bytes when replacing it; never point at the bare domain.
export const EMMA_PREVIEW = {
  title: "Emma Donnersberg — Maison Affluency",
  description: "Explore the curated collection and masterworks of furniture designer Emma Donnersberg, connecting Paris and New York styles.",
  image: absoluteUrl(emmaHero.url),
};

export function getDesignerOpenGraph(designer: DesignerOpenGraphInput) {
  const emma = designer.slug === "emma-donnersberg";
  const image = emma ? EMMA_PREVIEW.image : toOgImage(designer.heroImage);
  return {
    title: emma ? EMMA_PREVIEW.title : `${designer.name} — Maison Affluency`,
    description: emma ? EMMA_PREVIEW.description : designer.description,
    image,
    imageType: /res\.cloudinary\.com.*f_jpg|\.jpe?g(?:\?|$)/i.test(image) ? "image/jpeg" : undefined,
    imageAlt: emma ? "Emma Donnersberg living-room interior" : designer.name,
    type: "profile",
    url: absoluteUrl(`/designers/${designer.slug}`),
  };
}