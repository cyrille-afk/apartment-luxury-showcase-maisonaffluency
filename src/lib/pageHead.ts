import { absoluteUrl } from "@/config/site";
import { seoDescription, seoText } from "@/lib/seoText";

/**
 * Server-rendered social preview tags (WhatsApp, LinkedIn, Slack read only the
 * first HTML response). Images must be authentic photos sized 1200×630 and
 * kept under 300KB — Cloudinary `w_1200,h_630,c_fill,f_jpg` renditions.
 */
export type PageHeadInput = {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  imageAlt?: string;
  type?: "website" | "article" | "product" | "profile";
};

export function buildPageHead({ title, description, path, image, imageAlt, type = "website" }: PageHeadInput) {
  title = seoText(title, 60);
  description = seoDescription(description, "Explore the curated furniture and design collection at Maison Affluency.");
  const url = absoluteUrl(path);
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: type },
    { property: "og:site_name", content: "Maison Affluency" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
  if (image && /^https:\/\//.test(image)) {
    meta.push(
      { property: "og:image", content: image },
      { property: "og:image:secure_url", content: image },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: imageAlt || title },
      { name: "twitter:image", content: image },
    );
  }
  return { meta };
}

const CLD = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg";
const HOME_IMAGE = `${CLD}/v1772516480/WhatsApp_Image_2026-03-03_at_1.40.10_PM_cs23b7.jpg`;
const DESIGNERS_IMAGE = `${CLD}/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg`;
const GALLERY_IMAGE = `${CLD}/living-room-hero_zxfcxl.jpg`;
const TOUR_IMAGE = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,g_auto,q_auto,f_jpg/bespoke-sofa_gxidtx.jpg";
const TRADE_IMAGE = "https://www.maisonaffluency.com/trade-program-hero-authentic-v3.jpg";

export const STATIC_PAGE_HEADS = {
  home: {
    title: "Maison Affluency | Luxury Furniture & Collectible Design",
    description: "Discover exceptional collectible furniture, bespoke interiors, and contemporary design by world-renowned designers and ateliers. Based in Singapore.",
    path: "/",
    image: HOME_IMAGE,
  },
  designers: {
    title: "Designers & Ateliers — Maison Affluency",
    description: "Discover our curated selection of ateliers and designers — from historical masters to contemporary creators of collectible furniture and lighting.",
    path: "/designers",
    image: DESIGNERS_IMAGE,
  },
  tradeProgram: {
    title: "Trade Program — Maison Affluency",
    description: "Join Maison Affluency's Trade Program for architects and interior designers — exclusive pricing, dedicated advisors, custom sourcing, and insured shipping.",
    path: "/trade-program",
    image: TRADE_IMAGE,
  },
  journal: {
    title: "Journal — Maison Affluency",
    description: "Design stories, designer interviews, and curatorial insights from Maison Affluency — collectible luxury furniture from Singapore.",
    path: "/journal",
    image: HOME_IMAGE,
  },
  gallery: {
    title: "Interactive Gallery — Maison Affluency",
    description: "Explore our Singapore gallery — room-by-room interiors with collectible furniture, bespoke lighting, and artisan rugs by world-renowned designers.",
    path: "/gallery",
    image: GALLERY_IMAGE,
  },
  newIn: {
    title: "New In — Maison Affluency",
    description: "Discover new designers and curated collections at Maison Affluency.",
    path: "/new-in",
    image: DESIGNERS_IMAGE,
  },
  contact: {
    title: "Contact — Maison Affluency",
    description: "Contact Maison Affluency by appointment in Singapore and Paris. Private concierge for bespoke inquiries, custom specifications, and designer collaborations.",
    path: "/contact",
    image: HOME_IMAGE,
  },
  apartmentTour: {
    title: "A Private Apartment Tour — Maison Affluency",
    description: "An exclusive cinematic tour of a bespoke Singapore apartment curated by Maison Affluency — collectible furniture and artisan craftsmanship.",
    path: "/apartment-tour",
    image: TOUR_IMAGE,
  },
} satisfies Record<string, PageHeadInput>;
