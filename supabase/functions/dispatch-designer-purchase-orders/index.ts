import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildPurchaseOrderPdf, type PoPdfLine } from "../_shared/purchaseOrderPdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const money = (cents: number, currency: string) =>
  `${currency.toUpperCase()} ${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Background worker: turns one settled checkout into one purchase order per
 * designer (Maison Affluency is the merchant of record and buys wholesale).
 *
 * For each designer in the order it assigns PO-YYYY-MMDD-NNN, renders the
 * wholesale PDF, stores it privately, emails the designer's fulfillment desk a
 * signed link, and marks the payable lines "pending_invoice_match".
 *
 * Idempotent per (order_id, designer_id): re-running an already dispatched
 * order is a no-op.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const stripeSessionId =
      typeof body?.stripeSessionId === "string" ? body.stripeSessionId.trim() : null;
    if (!orderId) return json({ error: "orderId is required." }, 400);

    // Internal callers use the service role key; anything else must be an admin.
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const isService = authHeader === (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "___");
    if (!isService) {
      const anon = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      );
      const { data: claims } = await anon.auth.getClaims(authHeader);
      const sub = (claims?.claims as Record<string, unknown> | undefined)?.sub;
      if (!sub) return json({ error: "Authentication required." }, 401);
      const roles = await Promise.all(
        (["admin", "super_admin"] as const).map((role) =>
          supabase.rpc("has_role", { _user_id: String(sub), _role: role }).then(
            (r) => Boolean(r.data),
            () => false,
          ),
        ),
      );
      if (!roles.some(Boolean)) return json({ error: "Admin access required." }, 403);
    }

    const { data: payables, error: payErr } = await supabase
      .from("purchase_orders_payable")
      .select("*")
      .eq("order_id", orderId);
    if (payErr) return json({ error: payErr.message }, 500);
    if (!payables || payables.length === 0) return json({ ok: true, dispatched: 0, reason: "no_payables" });

    const { data: order } = await supabase
      .from("shop_orders")
      .select("id, order_ref")
      .eq("id", orderId)
      .maybeSingle();

    const lineIds = payables.map((p: any) => p.line_item_id).filter(Boolean);
    const itemById = new Map<string, any>();
    if (lineIds.length) {
      const { data: items } = await supabase
        .from("shop_order_items")
        .select("id, title, quantity, variant_label")
        .in("id", lineIds);
      for (const i of items ?? []) itemById.set(i.id, i);
    }

    const designerIds = [...new Set(payables.map((p: any) => p.designer_id).filter(Boolean))];
    const designerById = new Map<string, any>();
    if (designerIds.length) {
      const { data: designers } = await supabase
        .from("designers")
        .select("id, name, fulfillment_email, wholesale_contract_tier, wholesale_discount_pct")
        .in("id", designerIds);
      for (const d of designers ?? []) designerById.set(d.id, d);
    }

    // One purchase order per designer in this cart.
    const groups = new Map<string, any[]>();
    for (const row of payables) {
      const key = row.designer_id ?? `unattributed:${row.designer_name ?? "unknown"}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    const results: Record<string, unknown>[] = [];

    for (const [key, rows] of groups) {
      const designerId = rows[0].designer_id ?? null;
      const designer = designerId ? designerById.get(designerId) : null;
      const designerName = designer?.name ?? rows[0].designer_name ?? "Unattributed";
      const currency = (rows[0].currency ?? "usd").toLowerCase();

      const { data: existing } = await supabase
        .from("designer_purchase_orders")
        .select("id, po_number, email_status")
        .eq("order_id", orderId)
        .eq("designer_id", designerId)
        .maybeSingle();
      if (existing?.email_status === "sent") {
        results.push({ designer: designerName, poNumber: existing.po_number, skipped: "already_sent" });
        continue;
      }

      let poNumber = existing?.po_number as string | undefined;
      if (!poNumber) {
        const { data: generated, error: seqErr } = await supabase.rpc("next_designer_po_number");
        if (seqErr || !generated) {
          results.push({ designer: designerName, error: seqErr?.message ?? "po_number_failed" });
          continue;
        }
        poNumber = String(generated);
      }

      const lines: PoPdfLine[] = rows.map((r: any) => {
        const item = r.line_item_id ? itemById.get(r.line_item_id) : null;
        return {
          description: item?.title ?? "Commissioned piece",
          reference: item?.variant_label ?? null,
          quantity: Number(item?.quantity ?? 1),
          retailRrp: r.retail_rrp ?? 0,
          wholesaleDiscountPct: Number(r.wholesale_discount_pct ?? 30),
          purchaseCostCogs: r.purchase_cost_cogs ?? 0,
        };
      });
      const totalRrp = lines.reduce((a, l) => a + l.retailRrp, 0);
      const totalCogs = lines.reduce((a, l) => a + l.purchaseCostCogs, 0);
      const issuedAt = new Date();

      const pdfBytes = await buildPurchaseOrderPdf({
        poNumber,
        issuedAt,
        currency,
        designerName,
        designerEmail: designer?.fulfillment_email ?? null,
        contractTier: designer?.wholesale_contract_tier ?? null,
        orderRef: order?.order_ref ?? null,
        lines,
      });

      let documentPath: string | null = null;
      let downloadUrl: string | null = null;
      try {
        documentPath = `designer-po/${orderId}/${poNumber}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("purchase-orders")
          .upload(documentPath, pdfBytes, { contentType: "application/pdf", upsert: true });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("purchase-orders")
          .createSignedUrl(documentPath, 60 * 60 * 24 * 30);
        downloadUrl = signed?.signedUrl ?? null;
      } catch (storageErr) {
        console.error("[PO-DISPATCH] storage failed:", storageErr);
        documentPath = null;
      }

      const recipient = designer?.fulfillment_email ?? null;
      let emailStatus = "no_recipient";
      let emailError: string | null = recipient ? null : "No fulfillment email on file for this designer.";

      // Persist the PO first so its one-click acknowledgement token exists
      // before the email goes out.
      const { data: poRow, error: poErr } = await supabase
        .from("designer_purchase_orders")
        .upsert(
          {
            ...(existing?.id ? { id: existing.id } : {}),
            po_number: poNumber,
            order_id: orderId,
            designer_id: designerId,
            designer_name: designerName,
            designer_email: recipient,
            wholesale_contract_tier: designer?.wholesale_contract_tier ?? null,
            currency,
            line_count: lines.length,
            total_retail_rrp: totalRrp,
            total_purchase_cost_cogs: totalCogs,
            document_path: documentPath,
            email_status: "pending",
            stripe_session_id: stripeSessionId,
            updated_at: issuedAt.toISOString(),
          },
          { onConflict: "order_id,designer_id" },
        )
        .select("id, ack_token")
        .maybeSingle();
      if (poErr) console.error("[PO-DISPATCH] ledger write failed:", poErr.message);

      const acknowledgeUrl = poRow?.ack_token
        ? `${Deno.env.get("SUPABASE_URL")}/functions/v1/acknowledge-purchase-order?token=${poRow.ack_token}`
        : null;

      if (recipient) {
        const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "designer-purchase-order",
            recipientEmail: recipient,
            idempotencyKey: `designer-po-${poNumber}`,
            templateData: {
              designerName,
              poNumber,
              issuedAt: issuedAt.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
              lineCount: lines.length,
              totalCost: money(totalCogs, currency),
              downloadUrl,
              acknowledgeUrl,
            },
          },
        });
        if (mailErr) {
          emailStatus = "failed";
          emailError = String(mailErr.message ?? mailErr);
          console.error("[PO-DISPATCH] email failed:", emailError);
        } else {
          emailStatus = "sent";
          emailError = null;
        }
      }

      if (poRow?.id) {
        const { error: updErr } = await supabase
          .from("designer_purchase_orders")
          .update({
            email_status: emailStatus,
            email_error: emailError,
            dispatched_at: emailStatus === "sent" ? issuedAt.toISOString() : null,
            updated_at: issuedAt.toISOString(),
          })
          .eq("id", poRow.id);
        if (updErr) console.error("[PO-DISPATCH] status update failed:", updErr.message);
      }

      // Audit trail on the payable ledger.
      await supabase
        .from("purchase_orders_payable")
        .update({
          purchase_order_id: poRow?.id ?? null,
          po_number: poNumber,
          designer_invoice_status: "pending_invoice_match",
          updated_at: issuedAt.toISOString(),
        })
        .in(
          "id",
          rows.map((r: any) => r.id),
        );

      results.push({
        designer: designerName,
        poNumber,
        lines: lines.length,
        total: money(totalCogs, currency),
        emailStatus,
      });
    }

    return json({ ok: true, dispatched: results.length, results });
  } catch (err) {
    console.error("dispatch-designer-purchase-orders error:", err);
    return json({ error: "Unexpected error." }, 500);
  }
});
