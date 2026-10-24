/**
 * Visual Search server functions.
 *
 * Catalogue imagery is embedded with google/gemini-embedding-2 (multimodal,
 * 3072 dims) into public.product_image_embeddings; an uploaded room photo is
 * embedded with the same model and matched by pgvector cosine similarity via
 * the match_product_images RPC. Text embeddings in product_embeddings are a
 * separate model/space and stay untouched.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1";
const EMBED_MODEL = "google/gemini-embedding-2";
const EMBED_DIMENSIONS = 3072;
const BACKFILL_BATCH = 12;
const EMBED_CONCURRENCY = 3;
// ~2.5 MB base64 payload ceiling (the client resizes to <=1024px JPEG).
const MAX_IMAGE_CHARS = 3_500_000;

export interface VisualSearchMatch {
  pick_id: string;
  title: string | null;
  designer_name: string | null;
  image_url: string | null;
  similarity: number;
}

async function embedImageContent(
  apiKey: string,
  imageUrl: string,
  caption: string,
): Promise<number[]> {
  const res = await fetch(`${AI_GATEWAY}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: [
        {
          content: [
            { type: "text", text: caption },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      encoding_format: "float",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`AI gateway ${res.status}: ${text.slice(0, 200)}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const embedding = data?.data?.[0]?.embedding as number[] | undefined;
  if (!embedding?.length) throw new Error("No embedding returned");
  if (embedding.length !== EMBED_DIMENSIONS) {
    throw new Error(`Unexpected embedding dimensions: ${embedding.length}`);
  }
  return embedding;
}

/** Embed an uploaded photo and return the nearest catalogue pieces. */
export const searchCatalogueByImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { image: string }) => {
    const image = String(input?.image ?? "");
    if (!image) throw new Error("Missing image");
    if (image.length > MAX_IMAGE_CHARS) {
      throw new Error("Image too large — please use a smaller photo.");
    }
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(image) && !/^https:\/\//.test(image)) {
      throw new Error("Unsupported image format");
    }
    return { image };
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Visual search is not configured");

    const embedding = await embedImageContent(
      apiKey,
      data.image,
      "An interior design reference photo. Find luxury furniture, lighting and decor catalogue pieces that visually match the pieces, materials, forms and style in this image.",
    );

    const { data: matches, error } = await context.supabase.rpc("match_product_images", {
      query_embedding: JSON.stringify(embedding),
      match_count: 8,
    } as never);
    if (error) throw new Error("Match lookup failed");

    return { matches: ((matches ?? []) as unknown as VisualSearchMatch[]) };
  });

export interface ImageEmbeddingStatus {
  total: number;
  embedded: number;
  missing: number;
}

async function countImageEmbeddingCoverage(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server") extends never
    ? never
    : any,
): Promise<ImageEmbeddingStatus> {
  const { count: total, error: e1 } = await supabaseAdmin
    .from("designer_curator_picks")
    .select("id", { count: "exact", head: true })
    .neq("is_hidden", true)
    .not("image_url", "is", null)
    .neq("image_url", "");
  if (e1) throw e1;
  const { count: embedded, error: e2 } = await supabaseAdmin
    .from("product_image_embeddings")
    .select("pick_id", { count: "exact", head: true });
  if (e2) throw e2;
  return {
    total: total ?? 0,
    embedded: embedded ?? 0,
    missing: Math.max((total ?? 0) - (embedded ?? 0), 0),
  };
}

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

/** Admin: how much of the catalogue imagery is embedded so far. */
export const getImageEmbeddingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImageEmbeddingStatus> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return countImageEmbeddingCoverage(supabaseAdmin);
  });

export interface ImageBackfillResult extends ImageEmbeddingStatus {
  processed: number;
  succeeded: number;
  failed: number;
}

/** Admin: embed one batch of catalogue product images. Call until missing = 0. */
export const backfillProductImageEmbeddings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImageBackfillResult> => {
    await requireAdmin(context);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Visual search is not configured");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: exErr } = await supabaseAdmin
      .from("product_image_embeddings")
      .select("pick_id");
    if (exErr) throw exErr;
    const done = new Set((existing ?? []).map((r) => r.pick_id as string));

    const { data: picks, error: pErr } = await supabaseAdmin
      .from("designer_curator_picks")
      .select("id, title, image_url, designer_id")
      .neq("is_hidden", true)
      .not("image_url", "is", null)
      .neq("image_url", "")
      .order("created_at", { ascending: true })
      .limit(2000);
    if (pErr) throw pErr;

    const pending = (picks ?? []).filter((p) => !done.has(p.id)).slice(0, BACKFILL_BATCH);
    if (!pending.length) {
      return { processed: 0, succeeded: 0, failed: 0, ...(await countImageEmbeddingCoverage(supabaseAdmin)) };
    }

    const designerIds = [...new Set(pending.map((p) => p.designer_id).filter(Boolean))] as string[];
    const nameById = new Map<string, string>();
    if (designerIds.length) {
      const { data: designers } = await supabaseAdmin
        .from("designers")
        .select("id, name, display_name")
        .in("id", designerIds);
      (designers ?? []).forEach((d) => {
        nameById.set(d.id, d.display_name || d.name || "Unattributed");
      });
    }

    let succeeded = 0;
    let failed = 0;
    // Bounded parallelism: the workspace shares one AI rate-limit budget.
    for (let i = 0; i < pending.length; i += EMBED_CONCURRENCY) {
      const slice = pending.slice(i, i + EMBED_CONCURRENCY);
      const settled = await Promise.allSettled(
        slice.map(async (p) => {
          const designerName = (p.designer_id && nameById.get(p.designer_id)) || "Unattributed";
          const title = p.title?.trim() || "Untitled";
          const embedding = await embedImageContent(
            apiKey,
            p.image_url!,
            `Product photograph of ${title} by ${designerName}, luxury collectible furniture and lighting catalogue piece.`,
          );
          const { error: upErr } = await supabaseAdmin.from("product_image_embeddings").upsert(
            {
              pick_id: p.id,
              designer_name: designerName,
              title,
              image_url: p.image_url,
              embedding: JSON.stringify(embedding),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "pick_id" },
          );
          if (upErr) throw upErr;
        }),
      );
      for (const r of settled) {
        if (r.status === "fulfilled") succeeded += 1;
        else {
          failed += 1;
          console.error("image embed failed:", r.reason);
        }
      }
    }

    return {
      processed: pending.length,
      succeeded,
      failed,
      ...(await countImageEmbeddingCoverage(supabaseAdmin)),
    };
  });
