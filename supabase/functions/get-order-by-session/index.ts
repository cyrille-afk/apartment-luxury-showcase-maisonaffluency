import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{24,}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    let sessionId = "";
    let emailProof = "";

    if (req.method === "GET") {
      const url = new URL(req.url);
      sessionId = url.searchParams.get("session_id")?.trim() ?? "";
      emailProof = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
    } else {
      const body = await req.json().catch(() => ({}));
      sessionId = typeof body?.session_id === "string" ? body.session_id.trim() : "";
      emailProof = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    }

    if (!SESSION_ID_PATTERN.test(sessionId)) {
      return json({ error: "Invalid session identifier." }, 400);
    }

    // The session id alone is no longer enough: require a signed-in caller
    // whose email matches the order, or a guest who also supplies the order
    // email address as proof of ownership.
    let callerEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseAnon = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      );
      const { data: claimsData } = await supabaseAnon.auth.getClaims(
        authHeader.replace("Bearer ", ""),
      );
      const claims = claimsData?.claims as Record<string, unknown> | undefined;
      if (typeof claims?.email === "string") callerEmail = claims.email.toLowerCase();
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("product_name, selected_finish, customer_email, transaction_id, amount_total, currency, status, created_at")
      .eq("transaction_id", sessionId)
      .maybeSingle();

    if (error) {
      console.error("[get-order-by-session] query error", error);
      return json({ error: "Unable to retrieve order." }, 500);
    }

    if (!data) {
      return json({ error: "Order not found." }, 404);
    }

    // Mask the email: the session id alone shouldn't reveal full contact details.
    const masked = data.customer_email
      ? String(data.customer_email).replace(/^(.)(.*)(@.*)$/, (_m, a, b, c) => a + "*".repeat(Math.min(6, Math.max(1, b.length))) + c)
      : null;
    return json({ order: { ...data, customer_email: masked } });
  } catch (err) {
    console.error("[get-order-by-session] error", err);
    return json({ error: "Unable to retrieve order." }, 500);
  }
});
