import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Public, unauthenticated. Returns the full public-safe spec for a single curator
// pick. Pricing is always "Price on Request" — trade net prices, tearsheet PDFs,
// and CAD assets remain gated behind trade registration on the site itself.

const SITE_ORIGIN = "https://www.maisonaffluency.com";

function getClient() {
  const url = process.env.SUPABASE_URL!;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

export default defineTool({
  name: "get_product",
  title: "Get product",
  description:
    "Fetch the full public specification for a single curator pick by id: designer, category, materials, dimensions, edition, lead time, gallery images, and a deep link back to the product page. Trade pricing and tearsheet PDFs are never returned — those require signing in as a trade member on maisonaffluency.com.",
  inputSchema: {
    pick_id: z.string().uuid().describe("The curator pick id returned by search_curator_picks."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ pick_id }) => {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("designer_curator_picks_public")
      .select(
        "id, designer_id, title, subtitle, category, subcategory, materials, materials_description, dimensions, description, edition, edition_number, edition_signing, origin, lead_time, tags, image_url, gallery_images, gallery_captions, photo_credit, is_hidden",
      )
      .eq("id", pick_id)
      .maybeSingle();

    if (error) {
      return { content: [{ type: "text", text: `Lookup failed: ${error.message}` }], isError: true };
    }
    if (!data || data.is_hidden) {
      return {
        content: [{ type: "text", text: "Product not found or not publicly available." }],
        isError: true,
      };
    }

    const { data: designer } = await supabase
      .from("designers")
      .select("id, name, slug, is_published, trade_only")
      .eq("id", data.designer_id!)
      .maybeSingle();

    if (!designer || !designer.is_published || designer.trade_only) {
      return {
        content: [{ type: "text", text: "Product not found or not publicly available." }],
        isError: true,
      };
    }

    const product = {
      id: data.id,
      title: data.title,
      subtitle: data.subtitle,
      designer: designer.name,
      designer_slug: designer.slug,
      category: data.category,
      subcategory: data.subcategory,
      materials: data.materials,
      materials_description: data.materials_description,
      dimensions: data.dimensions,
      description: data.description,
      edition: data.edition,
      edition_number: data.edition_number,
      edition_signing: data.edition_signing,
      origin: data.origin,
      lead_time: data.lead_time,
      tags: data.tags,
      image_url: data.image_url,
      gallery_images: data.gallery_images ?? [],
      gallery_captions: data.gallery_captions ?? null,
      photo_credit: data.photo_credit,
      price: "Price on Request",
      product_url: `${SITE_ORIGIN}/designers/${designer.slug}?pick=${data.id}`,
      tearsheet_note:
        "Tearsheet PDFs and net trade pricing are available only to registered trade members on maisonaffluency.com.",
    };

    const text = [
      `${product.title}${product.subtitle ? " — " + product.subtitle : ""}`,
      `Designer: ${product.designer}`,
      product.category ? `Category: ${product.category}${product.subcategory ? " / " + product.subcategory : ""}` : null,
      product.materials ? `Materials: ${product.materials}` : null,
      product.dimensions ? `Dimensions: ${product.dimensions}` : null,
      product.edition ? `Edition: ${product.edition}` : null,
      product.lead_time ? `Lead time: ${product.lead_time}` : null,
      `Price: Price on Request`,
      `View: ${product.product_url}`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      content: [{ type: "text", text }],
      structuredContent: { product },
    };
  },
});
