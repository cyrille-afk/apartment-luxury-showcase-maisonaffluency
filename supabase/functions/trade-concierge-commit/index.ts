import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Resolve a curator pick to a trade_products.id, creating a row if needed. */
async function resolvePickToTradeProduct(
  supabase: ReturnType<typeof createClient>,
  pickId: string,
): Promise<{ tradeProductId: string | null; pick: any | null }> {
  const { data: pick } = await supabase
    .from("designer_curator_picks")
    .select("id, title, image_url, dimensions, materials, category, subcategory, designer_id, gallery_images, lead_time, currency, trade_price_cents, description, origin, price_prefix, pdf_url")
    .eq("id", pickId)
    .maybeSingle();

  if (!pick) return { tradeProductId: null, pick: null };

  const { data: designer } = await supabase
    .from("designers")
    .select("name, display_name")
    .eq("id", pick.designer_id)
    .maybeSingle();

  const brandName = designer?.name || designer?.display_name;
  if (!brandName || !pick.title) return { tradeProductId: null, pick };

  // 1. Exact match
  const { data: exact } = await supabase
    .from("trade_products")
    .select("id")
    .eq("brand_name", brandName)
    .eq("product_name", pick.title)
    .limit(1)
    .maybeSingle();
  if (exact?.id) return { tradeProductId: exact.id, pick };

  // 2. Create new (mirrors the sync trigger's COALESCE pattern)
  const { data: created, error } = await supabase
    .from("trade_products")
    .insert({
      brand_name: brandName,
      product_name: pick.title,
      category: pick.category || "Uncategorized",
      subcategory: pick.subcategory || null,
      currency: pick.currency || "EUR",
      trade_price_cents: pick.trade_price_cents,
      rrp_price_cents: pick.trade_price_cents,
      dimensions: pick.dimensions,
      materials: pick.materials,
      description: pick.description,
      lead_time: pick.lead_time,
      image_url: pick.image_url,
      gallery_images: pick.gallery_images,
      spec_sheet_url: pick.pdf_url,
      origin: pick.origin,
      price_prefix: pick.price_prefix,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("resolvePickToTradeProduct insert failed:", error.message);
    return { tradeProductId: null, pick };
  }
  return { tradeProductId: created?.id || null, pick };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { error: "Missing auth token" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate the user's JWT (uses signing keys per project standard)
    const { data: claimsData, error: claimsError } = await (supabase.auth as any).getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("getClaims failed:", claimsError);
      return json(401, { error: "Invalid auth token" });
    }
    const userId: string = claimsData.claims.sub;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { error: "Invalid JSON body" });

    const tool: string = body.tool;
    const args = body.args || {};

    if (tool !== "propose_tearsheet") {
      return json(400, { error: `Unsupported tool: ${tool}` });
    }

    const title: string = (args.title || "Untitled tearsheet").toString().slice(0, 120);
    const note: string | null = typeof args.note === "string" ? args.note.slice(0, 500) : null;
    const pickIds: string[] = Array.isArray(args.pick_ids)
      ? args.pick_ids.filter((x: unknown) => typeof x === "string")
      : [];

    if (pickIds.length === 0) return json(400, { error: "pick_ids must contain at least one ID" });
    if (pickIds.length > 24) return json(400, { error: "Too many picks (max 24)" });

    // Resolve every pick to a trade_products.id (create if needed)
    const resolved: Array<{ pickId: string; tradeProductId: string }> = [];
    const skipped: Array<{ pickId: string; reason: string }> = [];

    for (const pid of pickIds) {
      const { tradeProductId, pick } = await resolvePickToTradeProduct(supabase, pid);
      if (!tradeProductId) {
        skipped.push({ pickId: pid, reason: pick ? "could not create trade product" : "pick not found" });
        continue;
      }
      // Avoid dupes within the same proposal
      if (!resolved.some((r) => r.tradeProductId === tradeProductId)) {
        resolved.push({ pickId: pid, tradeProductId });
      }
    }

    if (resolved.length === 0) {
      return json(422, { error: "None of the picks could be resolved to a product", skipped });
    }

    // Create the board (status = draft so the user can rename/edit before sharing)
    const { data: board, error: boardErr } = await supabase
      .from("client_boards")
      .insert({
        user_id: userId,
        title,
        client_name: "",
        status: "draft",
      })
      .select("id, share_token")
      .single();

    if (boardErr || !board) {
      console.error("Board insert failed:", boardErr);
      return json(500, { error: "Could not create tearsheet" });
    }

    // Insert items in order
    const itemsPayload = resolved.map((r, i) => ({
      board_id: board.id,
      product_id: r.tradeProductId,
      sort_order: i,
      notes: i === 0 && note ? note : null,
    }));

    const { error: itemsErr } = await supabase
      .from("client_board_items")
      .insert(itemsPayload);

    if (itemsErr) {
      console.error("Board items insert failed:", itemsErr);
      // Roll back the empty board so the user doesn't see a stub
      await supabase.from("client_boards").delete().eq("id", board.id);
      return json(500, { error: "Could not add items to tearsheet" });
    }

    // Audit log (non-fatal)
    await supabase.from("trade_concierge_actions").insert({
      user_id: userId,
      tool: "propose_tearsheet",
      args: { title, note, pick_ids: pickIds, resolved_count: resolved.length, skipped },
      status: "approved",
      resulting_resource_id: board.id,
      resulting_resource_type: "client_board",
    });

    return json(200, {
      ok: true,
      board_id: board.id,
      url: `/trade/boards/${board.id}`,
      added: resolved.length,
      skipped,
    });
  } catch (e) {
    console.error("trade-concierge-commit error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
