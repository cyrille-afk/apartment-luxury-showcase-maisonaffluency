import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { toOgImage } from "@/lib/ogImage";
import type { PageHeadInput } from "@/lib/pageHead";
import { productSeoText, seoDescription, seoTitle } from "@/lib/seoText";

/**
 * Public-only lookups for server-rendered link previews. Uses the publishable
 * key, so only rows anonymous visitors can already read are returned
 * (published journal articles, public curator picks — never trade prices).
 */
function publicClient() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/;
const slugOf = (v: unknown) => {
  const s = String(v ?? "").trim().toLowerCase();
  if (!SLUG.test(s)) throw new Error("Invalid slug");
  return s;
};

const slugify = (s: string) =>
  String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Share-sized 1200×630 JPEG: Cloudinary transform, or Storage image rendering (originals can exceed WhatsApp's ~300KB limit). */
function shareImage(src: string | null | undefined): string | null {
  if (!src || !/^https:\/\//.test(src)) return null;
  const m = src.match(/^(https:\/\/[^/]+\.supabase\.co)\/storage\/v1\/object\/public\/(.+?)(\?.*)?$/);
  if (m) return `${m[1]}/storage/v1/render/image/public/${m[2]}?width=1200&height=630&resize=cover&quality=75`;
  return toOgImage(src);
}

export const getJournalHead = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: slugOf(input?.slug) }))
  .handler(async ({ data }): Promise<PageHeadInput | null> => {
    const supabase = publicClient();
    if (!supabase) return null;
    const { data: a } = await supabase
      .from("journal_articles")
      .select("slug, title, excerpt, cover_image_url")
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!a) return null;
    const title = seoTitle(a.title || "Journal");
    return {
      title,
      description: seoDescription(a.excerpt, "Design stories and curatorial insights from the Maison Affluency Journal."),
      path: `/journal/${a.slug}`,
      image: shareImage(a.cover_image_url),
      imageAlt: a.title || undefined,
      type: "article",
    };
  });

type Pick = { slug: string | null; title: string; subtitle: string | null; image_url: string | null; description: string | null; materials: string | null; designer_id: string | null };

export const getLegacyProductHead = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input?.id || "")) throw new Error("Invalid product id");
    return input;
  })
  .handler(async ({ data }): Promise<PageHeadInput | null> => {
    const client = publicClient();
    if (!client) return null;
    // Resolve only through public projections; never expose private Trade fields.
    const { data: twin } = await client.from("trade_products_public_rrp").select("source_pick_id").eq("id", data.id).maybeSingle();
    const { data: row } = await client.from("designer_curator_picks_public" as never)
      .select("slug, title, subtitle, image_url, description, materials, designer_id")
      .eq("id", twin?.source_pick_id || data.id).maybeSingle();
    const pick = row as unknown as Pick | null;
    if (!pick) return null;
    const { data: designer } = pick.designer_id
      ? await client.from("designers").select("name, display_name").eq("id", pick.designer_id).maybeSingle()
      : { data: null };
    const text = productSeoText({ name: pick.title, maker: designer?.display_name || designer?.name, description: pick.description, materials: pick.materials });
    return { ...text, path: `/product/${data.id}`, image: shareImage(pick.image_url), type: "product" };
  });

export const getProductHead = createServerFn({ method: "GET" })
  .inputValidator((input: { designerSlug?: string; productSlug: string }) => ({
    designerSlug: input?.designerSlug ? slugOf(input.designerSlug) : undefined,
    productSlug: slugOf(input?.productSlug),
  }))
  .handler(async ({ data }): Promise<PageHeadInput | null> => {
    const supabase = publicClient();
    if (!supabase) return null;
    const fields = "slug, title, subtitle, image_url, description, materials, designer_id";
    const view = "designer_curator_picks_public" as never;
    let designer: { id: string; name: string; display_name: string | null } | null = null;
    if (data.designerSlug) {
      const { data: d } = await supabase.from("designers").select("id, name, display_name").eq("slug", data.designerSlug).maybeSingle();
      designer = d;
    }
    let pick: Pick | null = null;
    if (designer) {
      const { data: list } = await supabase.from(view).select(fields).eq("designer_id", designer.id);
      const picks = (list ?? []) as unknown as Pick[];
      const ps = data.productSlug;
      pick =
        picks.find((p) => p.slug === ps) ||
        picks.find((p) => p.slug && slugify(p.slug) === ps) ||
        picks.find((p) => [slugify(p.title), slugify(p.title + (p.subtitle ? `-${p.subtitle}` : ""))].includes(ps)) ||
        null;
    }
    if (!pick) {
      const { data: row } = await supabase.from(view).select(fields).eq("slug", data.productSlug).limit(1).maybeSingle();
      pick = (row as unknown as Pick) ?? null;
    }
    if (!pick) return null;
    if (!designer && pick.designer_id) {
      const { data: d } = await supabase.from("designers").select("id, name, display_name").eq("id", pick.designer_id).maybeSingle();
      designer = d;
    }
    const maker = designer?.display_name || designer?.name || "";
    const name = pick.title.replace(/\s+/g, " ").trim();
    const { title, description } = productSeoText({ name, maker, description: pick.description, materials: pick.materials });
    const path = data.designerSlug ? `/designers/${data.designerSlug}/${data.productSlug}` : `/products/${data.productSlug}`;
    return { title, description, path, image: shareImage(pick.image_url), imageAlt: title, type: "product" };
  });
