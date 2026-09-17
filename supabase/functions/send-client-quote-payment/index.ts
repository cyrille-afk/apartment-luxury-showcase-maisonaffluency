import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const fmt = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: authError } = await userClient.auth.getClaims(token);
    const userId = (claims as any)?.claims?.sub ?? (claims as any)?.sub;
    if (authError || !userId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isSuper } = await admin.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!isAdmin && !isSuper) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const quoteId = typeof body.quoteId === "string" ? body.quoteId : "";
    const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
    const amountCents = Number(body.amountCents);
    const label = (typeof body.label === "string" && body.label.trim()) || "Full payment";
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    const origin = req.headers.get("origin") || "https://www.maisonaffluency.com";

    if (!quoteId) return json({ error: "Missing quoteId" }, 400);
    if (!recipientEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
      return json({ error: "A valid client email is required" }, 400);
    }
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return json({ error: "A valid amount is required" }, 400);
    }

    const { data: quote } = await admin
      .from("trade_quotes")
      .select("id, client_name, currency")
      .eq("id", quoteId)
      .maybeSingle();
    if (!quote) return json({ error: "Quote not found" }, 404);

    const currency = (typeof body.currency === "string" && body.currency) || quote.currency || "EUR";
    const quoteRef = `QU-${quoteId.slice(0, 6).toUpperCase()}`;

    const { data: items } = await admin
      .from("trade_quote_items")
      .select("quantity, variant_label, product:trade_products(name)")
      .eq("quote_id", quoteId);

    const { data: link, error: linkErr } = await admin
      .from("quote_payment_links")
      .insert({
        quote_id: quoteId,
        amount_cents: Math.round(amountCents),
        currency: currency.toUpperCase(),
        label,
        payer_email: recipientEmail,
        payer_name: quote.client_name,
        created_by: userId,
      })
      .select("id, token")
      .single();
    if (linkErr || !link) {
      console.error("[send-client-quote-payment] link insert failed", linkErr);
      return json({ error: "Could not create the payment link" }, 500);
    }

    const payUrl = `${origin}/pay/${link.token}`;

    const { error: mailErr } = await admin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "client-quote-payment",
        recipientEmail,
        idempotencyKey: `quote-pay-${link.id}`,
        templateData: {
          recipientName: quote.client_name ?? "",
          quoteRef,
          currency: currency.toUpperCase(),
          amountFormatted: fmt(Math.round(amountCents)),
          label,
          payUrl,
          note,
          lines: (items ?? []).map((i: any) => ({
            name: i.product?.name ?? "Bespoke item",
            finish: i.variant_label ?? null,
            quantity: i.quantity ?? 1,
          })),
        },
      },
    });

    if (mailErr) {
      console.error("[send-client-quote-payment] email failed", mailErr);
      return json({ error: "Payment link created, but the email could not be sent.", payUrl }, 502);
    }

    await admin
      .from("quote_email_log")
      .insert({
        quote_id: quoteId,
        recipient_email: recipientEmail,
        sent_by: userId,
        sent_by_email: (claims as any)?.claims?.email ?? (claims as any)?.email ?? "",
        note: `Payment link sent — ${label}`,
      })
      .then(() => undefined, () => undefined);

    return json({ payUrl, token: link.token });
  } catch (error) {
    console.error("[send-client-quote-payment]", error);
    return json({ error: "An unexpected error occurred" }, 500);
  }
});
