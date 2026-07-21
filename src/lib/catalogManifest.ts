// Client for the edge-cached catalog manifest.
//
// Uses a plain GET so browsers and any intermediate CDN (Cloudflare / Lovable
// hosting) actually cache the response according to the function's
// `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400` header.
//
// supabase.functions.invoke() is POST-only, which is uncacheable by CDNs — do
// NOT use it for this endpoint.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface CatalogManifestPick {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  hover_image_url: string | null;
  materials: string | null;
  dimensions: string | null;
  lead_time: string | null;
  origin: string | null;
  category: string | null;
  subcategory: string | null;
  pdf_url: string | null;
  designer_id: string;
  variant_placeholder: string | null;
  base_axis_label: string | null;
  top_axis_label: string | null;
  tags: string[] | null;
  sort_order: number | null;
  created_at: string | null;
}

export interface CatalogManifestDesigner {
  id: string;
  name: string;
  slug: string;
  display_name: string | null;
  source: string | null;
  founder: string | null;
  era: string | null;
  country: string | null;
  is_published: boolean;
  trade_only: boolean;
}

export interface CatalogManifest {
  generated_at: string;
  picks: CatalogManifestPick[];
  designers: CatalogManifestDesigner[];
}

export async function fetchCatalogManifest(): Promise<CatalogManifest> {
  const url = `${SUPABASE_URL}/functions/v1/catalog-manifest`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      // The Supabase gateway requires the anon key even for verify_jwt=false
      // functions. Sending it as a header (not query param) keeps the URL
      // stable and CDN-cacheable.
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`catalog-manifest failed: ${res.status}`);
  }

  return (await res.json()) as CatalogManifest;
}
