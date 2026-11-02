import { PRODUCTION_ORIGIN } from "./environmentIndexingGuard";
import type { SharedQuoteSnapshot } from "./quoteClientShare";

type QuoteIdentity = Pick<SharedQuoteSnapshot, "lines">;
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** The readable prefix is decorative; only the original secret token grants access. */
export function quoteAccessToken(segment: string): string | null {
  const match = segment.match(/(?:^|--)([a-f0-9]{48,64})$/i);
  return match?.[1] ?? null;
}

export function quoteShareUrl(token: string, snapshot: QuoteIdentity): string {
  const first = snapshot.lines[0];
  const label = first ? [first.maker, first.name, snapshot.lines.length > 1 ? "selection" : null].filter(Boolean).join(" ") : "quote";
  const slug = slugify(label).slice(0, 140).replace(/-+$/g, "") || "quote";
  return `${PRODUCTION_ORIGIN}/quote/${slug}--${token}`;
}

/** Preview text excludes client names, prices, finishes and internal quote information. */
export function quoteShareIdentity(snapshot: QuoteIdentity | null) {
  const first = snapshot?.lines[0];
  if (!first) return { title: "Quote unavailable — Maison Affluency", description: "Please ask your designer for a current quote link.", image: null, imageAlt: null };
  const name = first.name.replace(/\s+/g, " ").trim();
  const maker = first.maker?.replace(/\s+/g, " ").trim();
  const extra = snapshot.lines.length - 1;
  const subject = `${name}${maker ? ` by ${maker}` : ""}`;
  const title = `${subject}${extra > 0 ? ` + ${extra} more` : ""} — Maison Affluency`;
  const description = `View the shared quote for ${subject}${extra > 0 ? ` and ${extra} other piece${extra === 1 ? "" : "s"}` : ""}.`;
  // Letterbox the authentic product photo on the brand bone ground; never generate or outpaint preview images.
  const image = first.image?.startsWith("https://res.cloudinary.com/dif1oamtj/image/upload/")
    ? first.image.replace("/image/upload/", "/image/upload/w_1200,h_630,c_pad,b_rgb:FAF9F5,q_70,f_jpg/")
    : null;
  return { title, description, image, imageAlt: image ? subject : null };
}