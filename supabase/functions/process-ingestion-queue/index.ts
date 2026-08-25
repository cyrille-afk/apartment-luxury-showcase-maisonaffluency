// Processes queued supplier products into trade_products.
// Admin-only (or service-role cron). Bounded batch, single-flight lease, concurrency-limited.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_BATCH = 20;
const MAX_BATCH = 100;
const CONCURRENCY = 3;
const LEASE_MINUTES = 5;
const MAX_ATTEMPTS = 3;

type Row = {
  id: string;
  source_url: string;
  raw_data: Record<string, unknown> | null;
  attempts: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

function cents(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

/** Map raw supplier payload to a trade_products row. */
function mapProduct(row: Row) {
  const d = (row.raw_data ?? {}) as Record<string, unknown>;
  const sku = str(d.sku) ?? str(d.SKU) ?? str(d.product_code);
  const brand = str(d.brand_name) ?? str(d.brand) ?? str(d.manufacturer);
  const name = str(d.product_name) ?? str(d.name) ?? str(d.title);
  if (!sku) throw new Error("Missing sku in raw_data");
  if (!brand) throw new Error("Missing brand_name in raw_data");
  if (!name) throw new Error("Missing product_name in raw_data");

  const gallery = Array.isArray(d.gallery_images)
    ? (d.gallery_images as unknown[]).map((g) => str(g)).filter((g): g is string => !!g)
    : [];

  const priceRaw = d.trade_price_cents ?? d.rrp_price_cents ?? null;

  return {
    sku,
    brand_name: brand,
    product_name: name,
    description: str(d.description),
    category: str(d.category) ?? "",
    subcategory: str(d.subcategory) ?? "",
    currency: str(d.currency) ?? "SGD",
    dimensions: str(d.dimensions),
    materials: str(d.materials),
    lead_time: str(d.lead_time),
    image_url: str(d.image_url) ?? gallery[0] ?? null,
    gallery_images: gallery,
    spec_sheet_url: str(d.spec_sheet_url),
    origin: str(d.origin),
    // Prices are never auto-published: staged as hidden/inactive for manual review.
    trade_price_cents: cents(d.trade_price_cents ?? priceRaw),
    rrp_price_cents: cents(d.rrp_price_cents),
    is_active: false,
    is_hidden: true,
  };
}

async function processRow(
  supabase: ReturnType<typeof createClient>,
  row: Row,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload = mapProduct(row);
    const { data, error } = await supabase
      .from("trade_products")
      .upsert(payload, { onConflict: "sku" })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    await supabase
      .from("ingestion_queue")
      .update({
        status: "completed",
        error_message: null,
        product_id: data?.id ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const exhausted = row.attempts + 1 >= MAX_ATTEMPTS;
    await supabase
      .from("ingestion_queue")
      .update({
        status: exhausted ? "failed" : "pending",
        error_message: message,
        processed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return { ok: false, error: message };
  }
}

/** Native concurrency limiter: N workers pulling from a shared cursor. */
async function runWithLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceCall = authHeader === `Bearer ${serviceKey}`;

  if (!isServiceCall) {
    try {
      const auth = await requireAdmin(req);
      if (!auth.ok) return json(auth.body, auth.status);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Unauthorized" }, 401);
    }
  }

  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(Math.max(Number(body.batch_size) || DEFAULT_BATCH, 1), MAX_BATCH);
  const concurrency = Math.min(Math.max(Number(body.concurrency) || CONCURRENCY, 1), 10);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Paused-state guard
  const { data: state } = await supabase
    .from("ingestion_job_state")
    .select("is_paused, pause_reason, lease_until")
    .eq("id", true)
    .maybeSingle();

  if (state?.is_paused && !body.force) {
    return json({ skipped: "paused", reason: state.pause_reason ?? null });
  }

  // Single-flight lease (atomic, via SECURITY DEFINER RPC)
  const owner = crypto.randomUUID();
  const { data: leased, error: leaseError } = await supabase.rpc("acquire_ingestion_lease", {
    _owner: owner,
    _minutes: LEASE_MINUTES,
  });

  if (leaseError) {
    console.error("lease error", leaseError);
    return json({ error: leaseError.message }, 500);
  }
  if (!leased) {
    return json({ skipped: "locked", message: "Another ingestion run is in progress" });
  }


  try {
    const { data: rows, error } = await supabase
      .from("ingestion_queue")
      .select("id, source_url, raw_data, attempts")
      .eq("status", "pending")
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (error) throw new Error(error.message);
    const items = (rows ?? []) as Row[];
    if (items.length === 0) return json({ processed: 0, succeeded: 0, failed: 0, remaining: 0 });

    // Claim them (idempotent progress marking)
    await supabase
      .from("ingestion_queue")
      .update({ status: "processing" })
      .in("id", items.map((i) => i.id));
    for (const it of items) {
      await supabase
        .from("ingestion_queue")
        .update({ attempts: it.attempts + 1 })
        .eq("id", it.id);
    }

    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];
    await runWithLimit(items, concurrency, async (item) => {
      const res = await processRow(supabase, item);
      if (res.ok) succeeded++;
      else {
        failed++;
        if (res.error && errors.length < 10) errors.push(`${item.source_url}: ${res.error}`);
      }
    });

    const { count: remaining } = await supabase
      .from("ingestion_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    return json({ processed: items.length, succeeded, failed, remaining: remaining ?? 0, errors });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("ingestion_job_state").update({ last_error: message }).eq("id", true);
    return json({ error: message }, 500);
  } finally {
    await supabase.rpc("release_ingestion_lease", { _owner: owner });
  }
});
