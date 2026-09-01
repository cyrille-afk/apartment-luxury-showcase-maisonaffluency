// concierge-text-request — anonymous "Text our private concierge" intake from
// the cart SelectionDrawer. Validates a phone + short message, rate-limits per
// session, and stores the lead in concierge_leads for the concierge team.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9][0-9 ()-]{6,19}$/, "invalid phone"),
  message: z.string().trim().min(3).max(500),
  session_id: z.string().min(8).max(128),
  product: z.string().trim().max(200).optional().nullable(),
  configuration: z.string().trim().max(300).optional().nullable(),
  path: z.string().max(500).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    parsed = { success: false } as const;
  }
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const body = parsed.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Rate limit: max 5 concierge texts per session per hour.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("concierge_leads")
    .select("id", { count: "exact", head: true })
    .eq("session_id", body.session_id)
    .gte("created_at", since);
  if ((count ?? 0) >= 5) {
    return new Response(JSON.stringify({ error: "Rate limited" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const firstMessage = [
    "[Cart concierge text request]",
    `Mobile / WhatsApp: ${body.phone}`,
    body.product ? `Piece: ${body.product}` : null,
    body.configuration ? `Configuration: ${body.configuration}` : null,
    "",
    body.message,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const { error } = await supabase.from("concierge_leads").insert({
    surface: "public",
    session_id: body.session_id,
    first_message: firstMessage,
    intent: "cart_concierge_text",
    signals: { phone: body.phone, channel: "cart_drawer" },
    qualified_score: 0,
    path: body.path ?? null,
    referrer: body.referrer ?? null,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
  });
  if (error) {
    console.error("concierge_leads insert failed:", error);
    return new Response(JSON.stringify({ error: "Failed to save" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
