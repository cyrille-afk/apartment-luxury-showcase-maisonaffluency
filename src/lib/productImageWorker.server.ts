import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { embedImageContent } from "./imageEmbedding.server";
import { embeddingFailurePolicy, IMAGE_BATCH_SIZE, ImageEmbeddingError } from "./imageEmbeddingPolicy";

export async function processProductImageJobs(wakeToken?: string) {
  const { data: lease, error } = await supabaseAdmin.rpc("claim_product_image_worker", { wake_token: wakeToken });
  if (error) throw new ImageEmbeddingError("Unauthorized automatic indexing request.", 401);
  if (!lease) return { processed: 0, succeeded: 0, failed: 0 };
  let processed = 0, succeeded = 0, failed = 0;
  try {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      await supabaseAdmin.from("product_image_worker").update({ paused: true, pause_status: 401, pause_reason: "Visual Search is not configured." }).eq("id", true).throwOnError();
      throw new ImageEmbeddingError("Visual Search is not configured.", 401);
    }
    const { data: jobs } = await supabaseAdmin.from("product_image_jobs").select("*")
      .eq("status", "pending").lte("next_attempt_at", new Date().toISOString())
      .order("updated_at").limit(IMAGE_BATCH_SIZE).throwOnError();
    for (const job of jobs ?? []) {
      // Persisted circuit breaker is checked before EVERY provider call.
      const { data: state } = await supabaseAdmin.from("product_image_worker").select("paused,lease_id,lease_until").eq("id", true).single().throwOnError();
      if (state.paused || state.lease_id !== lease || Date.parse(state.lease_until ?? "") <= Date.now()) break;
      const { data: current } = await supabaseAdmin.from("product_image_jobs").select("revision,status").eq("pick_id", job.pick_id).maybeSingle().throwOnError();
      if (current?.revision !== job.revision || current.status !== "pending") continue;
      processed++;
      try {
        const { data: designer } = job.designer_id
          ? await supabaseAdmin.from("designers").select("name,display_name").eq("id", job.designer_id).maybeSingle().throwOnError()
          : { data: null };
        const name = designer?.display_name || designer?.name || "Unattributed";
        const title = job.title?.trim() || "Untitled";
        const embedding = await embedImageContent(apiKey, job.image_url, `Product photograph of ${title} by ${name}, luxury collectible furniture and lighting catalogue piece.`);
        const { data: committed } = await supabaseAdmin.rpc("finish_product_image_job", {
          job_pick: job.pick_id, job_revision: job.revision, worker_lease: lease,
          job_embedding: JSON.stringify(embedding), job_designer: name,
        }).throwOnError();
        if (committed) succeeded++;
      } catch (caught) {
        failed++;
        const failure = caught instanceof ImageEmbeddingError ? caught : new ImageEmbeddingError("Catalogue image indexing failed.", 500);
        const attempts = job.attempts + 1;
        const policy = embeddingFailurePolicy(failure, attempts);
        await supabaseAdmin.from("product_image_jobs").update({
          attempts, status: policy.pause || policy.retry ? "pending" : "failed", error: failure.message,
          next_attempt_at: new Date(Date.now() + policy.delayMs + Math.random() * 1000).toISOString(),
        }).eq("pick_id", job.pick_id).eq("revision", job.revision).throwOnError();
        if (policy.pause) {
          await supabaseAdmin.from("product_image_worker").update({ paused: true, pause_reason: failure.message, pause_status: failure.status }).eq("id", true).eq("lease_id", lease).throwOnError();
          break;
        }
        // A transient failure slows the whole pipeline, not just this image.
        if (policy.retry) break;
      }
    }
    return { processed, succeeded, failed };
  } finally {
    await supabaseAdmin.rpc("settle_product_image_worker", { worker_lease: lease }).throwOnError();
  }
}