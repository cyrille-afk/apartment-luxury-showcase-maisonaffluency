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
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ~2.5 MB base64 payload ceiling (the client resizes to <=1024px JPEG).
const MAX_IMAGE_CHARS = 3_500_000;

export interface VisualSearchMatch {
  pick_id: string;
  title: string | null;
  designer_name: string | null;
  image_url: string | null;
  similarity: number;
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

    const { embedImageContent } = await import("./imageEmbedding.server");
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
  paused: boolean;
  pauseReason: string | null;
  failed: number;
}

async function countImageEmbeddingCoverage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
): Promise<ImageEmbeddingStatus> {
  const { count: total, error: e1 } = await supabaseAdmin
    .from("designer_curator_picks")
    .select("id", { count: "exact", head: true })
    .neq("is_hidden", true)
    .not("image_url", "is", null)
    .neq("image_url", "");
  if (e1) throw e1;
  const { data: picks } = await supabaseAdmin.from("designer_curator_picks").select("id,image_url").eq("is_hidden", false).not("image_url", "is", null).neq("image_url", "").throwOnError();
  const { data: vectors } = await supabaseAdmin.from("product_image_embeddings").select("pick_id,image_url").throwOnError();
  const indexed = new Map((vectors ?? []).map((r) => [r.pick_id, r.image_url]));
  const embedded = (picks ?? []).filter((p) => indexed.get(p.id) === p.image_url).length;
  const { data: state } = await supabaseAdmin.from("product_image_worker").select("paused,pause_reason").eq("id", true).maybeSingle().throwOnError();
  const { count: failed } = await supabaseAdmin.from("product_image_jobs").select("pick_id", { count: "exact", head: true }).eq("status", "failed").throwOnError();
  return { total: total ?? 0, embedded, missing: Math.max((total ?? 0) - embedded, 0), paused: state?.paused ?? false, pauseReason: state?.pause_reason ?? null, failed: failed ?? 0 };
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

/** Explicit owner recovery; automatic callbacks never clear a provider block. */
export const backfillProductImageEmbeddings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImageBackfillResult> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("product_image_worker").update({ paused: false, pause_reason: null, pause_status: null }).eq("id", true).throwOnError();
    await supabaseAdmin.from("product_image_jobs").update({ status: "pending", attempts: 0, next_attempt_at: new Date().toISOString() }).eq("status", "failed").throwOnError();
    const { processProductImageJobs } = await import("./productImageWorker.server");
    const result = await processProductImageJobs();
    await supabaseAdmin.rpc("dispatch_product_image_jobs").throwOnError();
    return { ...result, ...(await countImageEmbeddingCoverage(supabaseAdmin)) };
  });
