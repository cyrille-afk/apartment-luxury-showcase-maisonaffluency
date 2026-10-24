import { beforeEach, expect, it, vi } from "vitest";
import { ImageEmbeddingError } from "./imageEmbeddingPolicy";

const mocks = vi.hoisted(() => ({ embed: vi.fn(), rpc: vi.fn(), jobs: [] as unknown[], writes: [] as { table: string; value: unknown }[] }));
vi.mock("./imageEmbedding.server", () => ({ embedImageContent: mocks.embed }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  rpc: mocks.rpc,
  from: (table: string) => {
    let writing = false;
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "lte", "order", "limit", "single", "maybeSingle"]) chain[method] = () => chain;
    chain.update = (value: unknown) => { writing = true; mocks.writes.push({ table, value }); return chain; };
    chain.throwOnError = async () => {
      if (writing) return {};
      if (table === "product_image_worker") return { data: { paused: false, lease_id: "lease", lease_until: "2099-01-01" } };
      if (table === "designers") return { data: { name: "Maker" } };
      // The batch query uses order; per-item revision reads use maybeSingle.
      return { data: mocks.jobs };
    };
    if (table === "product_image_jobs") {
      let batch = false;
      chain.order = () => { batch = true; return chain; };
      chain.throwOnError = async () => writing ? {} : { data: batch ? mocks.jobs : { revision: "revision", status: "pending" } };
    }
    return chain;
  },
} }));
import { processProductImageJobs } from "./productImageWorker.server";

beforeEach(() => {
  vi.stubEnv("LOVABLE_API_KEY", "test-only");
  mocks.embed.mockReset(); mocks.rpc.mockReset(); mocks.writes.length = 0;
  mocks.jobs = [1, 2].map((n) => ({ pick_id: `pick-${n}`, revision: "revision", status: "pending", attempts: 0, image_url: "https://example.test/photo.jpg", title: "Piece", designer_id: null }));
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "claim_product_image_worker" ? "lease" : true, error: null }));
});
it("a duplicate wake with no lease never calls the image provider", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  expect(await processProductImageJobs()).toEqual({ processed: 0, succeeded: 0, failed: 0 });
  expect(mocks.embed).not.toHaveBeenCalled();
});
it("persists provider denial and stops before processing the next image", async () => {
  mocks.embed.mockRejectedValue(new ImageEmbeddingError("Access denied", 403));
  expect(await processProductImageJobs()).toEqual({ processed: 1, succeeded: 0, failed: 1 });
  expect(mocks.embed).toHaveBeenCalledTimes(1);
  expect(mocks.writes).toContainEqual({ table: "product_image_worker", value: { paused: true, pause_reason: "Access denied", pause_status: 403 } });
  expect(mocks.rpc).toHaveBeenLastCalledWith("settle_product_image_worker", { worker_lease: "lease" });
});
it("atomically commits each vector against the claimed revision", async () => {
  mocks.embed.mockResolvedValue(Array(3072).fill(0.1));
  expect(await processProductImageJobs()).toEqual({ processed: 2, succeeded: 2, failed: 0 });
  expect(mocks.rpc).toHaveBeenCalledWith("finish_product_image_job", expect.objectContaining({ job_pick: "pick-1", job_revision: "revision", worker_lease: "lease" }));
});
it("defers the whole batch after rate limiting without immediate replay", async () => {
  mocks.embed.mockRejectedValue(new ImageEmbeddingError("Rate limited", 429));
  await processProductImageJobs();
  expect(mocks.embed).toHaveBeenCalledTimes(1);
  expect(mocks.writes[0]).toMatchObject({ table: "product_image_jobs", value: { attempts: 1, status: "pending" } });
});