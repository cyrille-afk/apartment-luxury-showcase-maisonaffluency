import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Dispatches an approved purchase order to its supplier.
 *
 * Stores the client-generated PO PDF in the private `purchase-orders` bucket and
 * emails the supplier (plus an optional cc address) a signed download link —
 * the email pipeline does not support file attachments.
 *
 * Fires only for line items whose `po_status` is already `approved` in the
 * database, so the dispatch cannot be spoofed from the client.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);
    const anon = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: claims, error: claimsErr } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
    const sub = (claims?.claims as Record<string, unknown> | undefined)?.sub;
    if (claimsErr || !sub) return json({ error: "Invalid or expired session." }, 401);
    const userId = String(sub);

    const body = await req.json().catch(() => ({}));
    const itemId = str(body?.itemId, 64);
    const pdfBase64 = typeof body?.pdfBase64 === "string" ? body.pdfBase64 : "";
    if (!itemId) return json({ error: "itemId is required." }, 400);

    /* Re-read the line server-side: never trust client-supplied status or pricing. */
    const { data: item, error: itemErr } = await supabase
      .from("trade_quote_items")
      .select(
        "id, quote_id, po_number, po_status, product_name, brand_name, quantity, supplier_id, required_by_date, lead_time_weeks_override",
      )
      .eq("id", itemId)
      .maybeSingle();
    if (itemErr || !item) return json({ error: "Quote line not found." }, 404);
    if (item.po_status !== "approved") return json({ error: "Purchase order is not approved." }, 409);
    if (!item.po_number) return json({ error: "No purchase order reference on this line." }, 409);

    /* Authorization: quote owner or admin/super_admin. */
    const { data: quote } = await supabase
      .from("trade_quotes")
      .select("id, user_id, quote_ref, project_name, client_name")
      .eq("id", item.quote_id)
      .maybeSingle();
    let authorized = quote?.user_id === userId;
    if (!authorized) {
      const checks = await Promise.all(
        (["admin", "super_admin"] as const).map((role) =>
          supabase.rpc("has_role", { _user_id: userId, _role: role }).then(
            (r) => Boolean(r.data),
            () => false,
          ),
        ),
      );
      authorized = checks.some(Boolean);
    }
    if (!authorized) return json({ error: "You are not authorized to dispatch this purchase order." }, 403);

    /* Resolve the supplier: explicit link first, then brand-name / alias match. */
    let supplier: { supplier_name: string; contact_email: string; cc_email: string | null } | null = null;
    if (item.supplier_id) {
      const { data } = await supabase
        .from("suppliers")
        .select("supplier_name, contact_email, cc_email")
        .eq("id", item.supplier_id)
        .maybeSingle();
      supplier = data ?? null;
    }
    if (!supplier && item.brand_name) {
      const brand = String(item.brand_name).trim().toLowerCase();
      const { data: candidates } = await supabase
        .from("suppliers")
        .select("supplier_name, contact_email, cc_email, brand_aliases")
        .eq("active", true)
        .limit(1000);
      supplier =
        (candidates ?? []).find(
          (s: Record<string, any>) =>
            String(s.supplier_name).trim().toLowerCase() === brand ||
            (s.brand_aliases ?? []).some((a: string) => String(a).trim().toLowerCase() === brand),
        ) ?? null;
    }
    if (!supplier?.contact_email) {
      return json({ error: "No supplier email on file for this brand.", reason: "supplier_missing" }, 422);
    }

    /* Store the PDF (best effort — never block the email on storage). */
    let downloadUrl: string | null = null;
    let storagePath: string | null = null;
    if (pdfBase64) {
      try {
        const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
        storagePath = `${item.quote_id}/${item.po_number}-${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("purchase-orders")
          .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("purchase-orders")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 30);
        downloadUrl = signed?.signedUrl ?? null;
      } catch (storageErr) {
        console.error("PO storage failed:", storageErr);
        storagePath = null;
      }
    }

    const templateData = {
      supplierName: supplier.supplier_name,
      poNumber: item.po_number,
      projectName: quote?.project_name ?? quote?.client_name ?? null,
      productName: item.product_name,
      brandName: item.brand_name,
      quantity: item.quantity,
      requiredBy: item.required_by_date
        ? new Date(item.required_by_date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : null,
      leadTime: item.lead_time_weeks_override ? `${item.lead_time_weeks_override} weeks` : null,
      downloadUrl,
    };

    const send = (recipientEmail: string, suffix: string) =>
      supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "purchase-order-dispatch",
          recipientEmail,
          idempotencyKey: `po-dispatch-${item.po_number}-${suffix}`,
          templateData,
        },
      });

    const { error: mailErr } = await send(supplier.contact_email, "supplier");
    if (mailErr) {
      console.error("send-transactional-email failed:", mailErr);
      return json({ error: "The purchase order could not be emailed to the supplier.", downloadUrl }, 502);
    }
    if (supplier.cc_email) {
      const { error: ccErr } = await send(supplier.cc_email, "cc");
      if (ccErr) console.error("cc dispatch failed:", ccErr);
    }

    await supabase
      .from("trade_quote_items")
      .update({
        po_dispatched_at: new Date().toISOString(),
        po_dispatch_email: supplier.contact_email,
        po_document_path: storagePath,
      })
      .eq("id", item.id);

    return json({
      ok: true,
      supplierName: supplier.supplier_name,
      supplierEmail: supplier.contact_email,
      ccEmail: supplier.cc_email ?? null,
      downloadUrl,
    });
  } catch (err) {
    console.error("send-purchase-order error:", err);
    return json({ error: "Unexpected error." }, 500);
  }
});
