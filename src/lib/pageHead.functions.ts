import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { toOgImage } from "@/lib/ogImage";
import type { PageHeadInput } from "@/lib/pageHead";

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

const clamp = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd() + "…";
};

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
    const title = `${clamp(a.title || "Journal", 50)} — Maison Affluency`;
    return {
      title,
      description: clamp(a.excerpt || "Design stories and curatorial insights from the Maison Affluency Journal.", 160),
      path: `/journal/${a.slug}`,
      image: shareImage(a.cover_image_url),
      imageAlt: a.title || undefined,
      type: "article",
    };
  });

type Pick = { slug: string | null; title: string; subtitle: string | null; image_url: string | null; description: string | null; materials: string | null; designer_id: string | null };

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
    const title = `${name}${maker ? ` by ${maker}` : ""} — Maison Affluency`;
    const description = clamp(
      pick.description || `${name}${maker ? ` by ${maker}` : ""}. ${pick.materials || "Collectible design at Maison Affluency."}`,
      155,
    );
    const path = data.designerSlug ? `/designers/${data.designerSlug}/${data.productSlug}` : `/products/${data.productSlug}`;
    return { title, description, path, image: shareImage(pick.image_url), imageAlt: title, type: "product" };
  });
