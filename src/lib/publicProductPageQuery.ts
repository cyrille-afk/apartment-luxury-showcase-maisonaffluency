import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { getCachedCatalog, type CatalogSnapshot } from "@/lib/catalogSource";

function slugify(s: string) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const PUBLIC_PRODUCT_PAGE_STALE_TIME = 5 * 60_000;

const publicPickFields =
  "id, slug, title, subtitle, image_url, hover_image_url, gallery_images, materials, materials_description, dimensions, description, category, subcategory, pdf_url, pdf_urls, lead_time, origin, designer_id, size_variants, variant_placeholder, base_axis_label, top_axis_label, wood_label_override, variant_image_map, edition, edition_number, edition_signing, gallery_captions, is_upholstered";

/**
 * Canonical fetcher for the public product page. Shared by the page itself and
 * by hover/focus prefetching so a warmed cache renders instantly on navigation.
 */
export async function fetchPublicProductPage(
  designerSlug: string | undefined,
  productSlug: string | undefined,
) {
  if (!designerSlug || !productSlug) return null;

  const { data: designerRow } = await supabase
    .from("designers")
    .select("id, name, slug, display_name, biography, founder")

    .eq("slug", designerSlug)
    .maybeSingle();
  // Parent houses are sometimes flagged trade_only / unpublished while still
  // being linked from public lightboxes — keep resolving their product URLs.
  let designer = designerRow as any;
  if (!designer) {
    // Unknown designer slug: resolve the product globally below.
    designer = { id: "", name: "", slug: designerSlug, display_name: null, biography: "" };
  }


  const brandCandidates = Array.from(
    new Set([designer.display_name, designer.name].filter(Boolean)),
  );

  // Anonymous visitors resolve the designer's pick list from the CDN-cached
  // catalogue manifest; only the single matched product is read live from the
  // database (indexed lookup by id) for its heavy detail fields.
  const cachedCatalog: CatalogSnapshot | null = await getCachedCatalog();
  const cachedDesignerPicks = cachedCatalog && designer.id
    ? cachedCatalog.picks
        .filter((p) => p.designer_id === designer.id)
        .sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER))
    : null;

  // Fetch picks and the trade-product image fallback in parallel;
  // trade_products is queried by brand so it can run concurrently
  // with picks rather than waiting for the product match.
  const [picksResult, tradeMatchesResult] = await Promise.all([
    cachedCatalog
      ? Promise.resolve({ data: (cachedDesignerPicks || []) as any[] })
      : designer.id
      ? supabase
          .from("designer_curator_picks_public" as any)
          .select(publicPickFields)
          .eq("designer_id", designer.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as any[] }),

    brandCandidates.length > 0
      ? supabase
          .from("trade_products")
          .select("product_name, image_url, gallery_images")
          .eq("is_active", true)
          .eq("is_hidden", false)
          .in("brand_name", brandCandidates as string[])
      : Promise.resolve({ data: [] as any[] }),
  ]);

  let picks = picksResult.data as any[] | null;
  const tradeMatches = tradeMatchesResult.data as any[] | null;

  const matchPick = (list: any[] | null) => {
    if (!list || list.length === 0) return null;
    return (
      list.find((p: any) => p.slug === productSlug) ||
      // Stored slugs generated before accent transliteration ("g-lule") still
      // need to resolve from the canonical accent-free URL ("gelule").
      list.find((p: any) => p.slug && slugify(p.slug) === slugify(productSlug)) ||
      list.find((p: any) => {
        const titleSlug = slugify(p.title);
        const shortSlug = slugify(String(p.title).replace(/\s+by\s+.+$/i, ""));
        const fullSlug = slugify(p.title + (p.subtitle ? `-${p.subtitle}` : ""));
        return fullSlug === productSlug || titleSlug === productSlug || shortSlug === productSlug;
      }) ||
      list.find((p: any) => productSlug.startsWith(`${slugify(p.title)}-`)) ||
      null
    );
  };

  // Canonical match on the stored slug column. Fall back to legacy
  // title-derived slugs so any bookmarked/shared URLs keep resolving.
  let product = matchPick(picks);

  // Parent houses (Marta Sala Éditions, Veronese, Ecart, Pouenat, CC-Tapis…)
  // hold no picks of their own — their profile aggregates the picks of the
  // designers they publish. Resolve across the whole founder family, then
  // fall back to a global slug lookup so any parent/child URL resolves.
  if (!product) {
    const familyNames = Array.from(
      new Set([designer.name, designer.display_name, designer.founder].filter(Boolean)),
    ) as string[];
    if (cachedCatalog) {
      const lowered = new Set(familyNames.map((n) => n.toLowerCase()));
      const familyIds = cachedCatalog.designers
        .filter(
          (d) =>
            d.id !== designer.id &&
            ((d.founder && lowered.has(d.founder.toLowerCase())) ||
              (d.name && lowered.has(d.name.toLowerCase()))),
        )
        .map((d) => d.id);
      if (familyIds.length > 0) {
        const familyPicks = cachedCatalog.picks
          .filter((p) => familyIds.includes(p.designer_id))
          .sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER)) as any[];
        const found = matchPick(familyPicks);
        if (found) {
          picks = familyPicks;
          product = found;
        }
      }
    } else if (familyNames.length > 0) {
      const { data: family } = await supabase
        .from("designers")
        .select("id")
        .or(
          `founder.in.(${familyNames.map((n) => `"${n.replace(/"/g, '')}"`).join(",")}),name.in.(${familyNames
            .map((n) => `"${n.replace(/"/g, '')}"`)
            .join(",")})`,
        );
      const familyIds = (family || []).map((c: any) => c.id).filter((id: string) => id !== designer.id);
      if (familyIds.length > 0) {
        const { data: familyPicks } = await supabase
          .from("designer_curator_picks_public" as any)
          .select(publicPickFields)
          .in("designer_id", familyIds)
          .order("sort_order", { ascending: true });
        const found = matchPick(familyPicks as any[] | null);
        if (found) {
          picks = familyPicks as any[];
          product = found;
        }
      }
    }
  }

  // Last resort: resolve the product by its canonical slug anywhere in the
  // public catalog (covers cross-brand links and unknown designer slugs).
  if (!product) {
    let globalPicks: any[] | null = null;
    if (cachedCatalog) {
      globalPicks = cachedCatalog.picks.filter((p) => p.slug === productSlug).slice(0, 1) as any[];
    } else {
      const { data } = await supabase
        .from("designer_curator_picks_public" as any)
        .select(publicPickFields)
        .eq("slug", productSlug)
        .limit(1);
      globalPicks = data as any[] | null;
    }
    const found = matchPick(globalPicks);
    if (found) {
      picks = globalPicks as any[];
      product = found;
    }
  }

  if (!product) return null;

  // The manifest carries only listing fields — hydrate the matched product with
  // its full detail row (single indexed lookup, not a list scan).
  if (cachedCatalog && product) {
    const { data: fullRow } = await supabase
      .from("designer_curator_picks_public" as any)
      .select(publicPickFields)
      .eq("id", (product as any).id)
      .maybeSingle();
    if (fullRow) product = { ...(product as any), ...(fullRow as any) };
  }

  // If the route designer was unresolvable (trade-only or unknown parent slug),
  // adopt the designer that actually owns the matched pick.
  if (!designer.id && (product as any).designer_id) {
    const { data: owner } = await supabase
      .from("designers")
      .select("id, name, slug, display_name, biography")
      .eq("id", (product as any).designer_id)
      .maybeSingle();
    if (owner) designer = owner as any;
  }



  const tradeProduct = tradeMatches?.find(
    (tp: any) => tp.product_name === (product as any).title,
  ) as { image_url?: string | null; gallery_images?: string[] | null } | undefined;

  return {
    product: {
      ...(product as any),
      variant_image_map: (product as any).variant_image_map || null,
      image_url: (product as any).image_url || tradeProduct?.image_url || null,
      gallery_images: (product as any).gallery_images?.length
        ? (product as any).gallery_images
        : tradeProduct?.gallery_images || null,
    },
    designer: {
      id: designer.id,
      name: designer.name,
      slug: designer.slug,
      biography: designer.biography || "",
    },
    relatedPicks: (picks as any[]).filter((p) => p.id !== (product as any).id),
  };
}

/** Warm the product-page cache (and its route chunk) on hover/focus/touch. */
export function prefetchPublicProductPage(
  queryClient: QueryClient,
  designerSlug: string | undefined,
  productSlug: string | undefined,
) {
  if (!designerSlug || !productSlug) return;
  // Warm the lazily-loaded route chunk too — the network round-trip for the
  // JS bundle is often the larger part of perceived navigation latency.
  void import("@/pages/PublicProductPage").catch(() => {});
  void queryClient.prefetchQuery({
    queryKey: queryKeys.publicProductPage(designerSlug, productSlug),
    queryFn: () => fetchPublicProductPage(designerSlug, productSlug),
    staleTime: PUBLIC_PRODUCT_PAGE_STALE_TIME,
  });
}
