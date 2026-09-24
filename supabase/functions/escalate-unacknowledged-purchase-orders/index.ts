import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireCronOrAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PENDING_STATUS = "pending_invoice_match";
const THRESHOLD_BUSINESS_HOURS = 48;
const DASHBOARD_URL = "https://www.maisonaffluency.com/trade/admin/procurement-ledger";
const LOGISTICS_EMAIL = "logistics@maisonaffluency.com";

/** Business hours elapsed (Mon–Fri counted, weekends skipped). */
function businessHoursElapsed(from: Date, to: Date): number {
  if (to <= from) return 0;
  let hours = 0;
  const cursor = new Date(from.getTime());
  // Advance in hour steps, capped at one year of wall-clock hours.
  for (let i = 0; i < 24 * 365 && cursor < to; i += 1) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) hours += 1;
    cursor.setUTCHours(cursor.getUTCHours() + 1);
  }
  return hours;
}

async function postSlackAlert(
  webhookUrl: string,
  po: { poNumber: string; designerName: string; daysElapsed: number; value: string },
) {
  const body = {
    text: `⚠️ PO OVERDUE ACKNOWLEDGMENT — ${po.poNumber}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "⚠️ PO OVERDUE ACKNOWLEDGMENT", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*PO Number*\n${po.poNumber}` },
          { type: "mrkdwn", text: `*Designer*\n${po.designerName}` },
          { type: "mrkdwn", text: `*Days Elapsed*\n${po.daysElapsed}` },
          { type: "mrkdwn", text: `*Wholesale Value*\n${po.value}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `This purchase order has not been acknowledged by the designer within 48 business hours. <${DASHBOARD_URL}|Open the Admin Procurement Dashboard>`,
        },
      },
    ],
  };
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Slack webhook ${res.status}: ${await res.text()}`);
}

/**
 * Daily worker: flags purchase orders still awaiting designer acknowledgement
 * after 48 business hours, alerts Slack + logistics email, and sets
 * requires_manual_followup on the payables ledger.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  {
    const __auth = await requireCronOrAdmin(req, "escalate-unacknowledged-purchase-orders");
    if (!__auth.ok) {
      return new Response(JSON.stringify(__auth.body), { status: __auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const now = new Date();
  const dryRun = new URL(req.url).searchParams.get("dry_run") === "1";

  const { data: rows, error } = await supabase
    .from("purchase_orders_payable")
    .select(
      "id, purchase_order_id, po_number, designer_name, currency, purchase_cost_cogs, created_at, requires_manual_followup",
    )
    .eq("designer_invoice_status", PENDING_STATUS)
    .lte("created_at", new Date(now.getTime() - 48 * 3600 * 1000).toISOString())
    .limit(2000);

  if (error) {
    console.error("[PO-ESCALATION] query failed:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Keep only rows whose PO has not been acknowledged.
  const poIds = [...new Set((rows ?? []).map((r) => r.purchase_order_id).filter(Boolean))] as string[];
  const acknowledged = new Set<string>();
  if (poIds.length) {
    const { data: pos } = await supabase
      .from("designer_purchase_orders")
      .select("id, acknowledged_at")
      .in("id", poIds);
    for (const p of pos ?? []) if (p.acknowledged_at) acknowledged.add(p.id);
  }

  type Group = {
    poId: string | null;
    poNumber: string;
    designerName: string;
    currency: string;
    cogs: number;
    oldest: Date;
    rowIds: string[];
  };
  const groups = new Map<string, Group>();

  for (const r of rows ?? []) {
    if (r.purchase_order_id && acknowledged.has(r.purchase_order_id)) continue;
    const created = new Date(r.created_at as string);
    if (businessHoursElapsed(created, now) < THRESHOLD_BUSINESS_HOURS) continue;

    const key = r.purchase_order_id ?? `payable:${r.id}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        poId: r.purchase_order_id ?? null,
        poNumber: (r.po_number as string) ?? "Unassigned PO",
        designerName: (r.designer_name as string) ?? "Designer",
        currency: String(r.currency ?? "usd").toUpperCase(),
        cogs: 0,
        oldest: created,
        rowIds: [],
      };
      groups.set(key, g);
    }
    g.cogs += r.purchase_cost_cogs ?? 0;
    if (created < g.oldest) g.oldest = created;
    g.rowIds.push(r.id as string);
  }

  const slackWebhook = Deno.env.get("SLACK_LOGISTICS_WEBHOOK_URL")?.trim();
  const escalated: Array<{ poNumber: string; designer: string; daysElapsed: number }> = [];

  for (const g of groups.values()) {
    const daysElapsed = Math.floor((now.getTime() - g.oldest.getTime()) / 86400000);
    const value = `${g.currency} ${(g.cogs / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    escalated.push({ poNumber: g.poNumber, designer: g.designerName, daysElapsed });
    if (dryRun) continue;

    const stamp = now.toISOString();
    const { error: flagErr } = await supabase
      .from("purchase_orders_payable")
      .update({ requires_manual_followup: true, followup_flagged_at: stamp, last_escalated_at: stamp, updated_at: stamp })
      .in("id", g.rowIds);
    if (flagErr) console.error("[PO-ESCALATION] flag failed:", flagErr.message);

    if (g.poId) {
      await supabase
        .from("designer_purchase_orders")
        .update({ requires_manual_followup: true, last_escalated_at: stamp, updated_at: stamp })
        .eq("id", g.poId);
    }

    if (slackWebhook) {
      try {
        await postSlackAlert(slackWebhook, {
          poNumber: g.poNumber,
          designerName: g.designerName,
          daysElapsed,
          value,
        });
      } catch (e) {
        console.error("[PO-ESCALATION] Slack alert failed:", (e as Error).message);
      }
    } else {
      console.warn("[PO-ESCALATION] SLACK_LOGISTICS_WEBHOOK_URL not configured; Slack alert skipped.");
    }

    const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "po-logistics-alert",
        recipientEmail: LOGISTICS_EMAIL,
        idempotencyKey: `po-overdue-${g.poNumber}-${now.toISOString().slice(0, 10)}`,
        templateData: {
          poNumber: g.poNumber,
          designerName: g.designerName,
          designerEmail: null,
          acknowledgedAt: `Not acknowledged — ${daysElapsed} day(s) elapsed`,
          totalCost: value,
          fulfillmentStatus: "OVERDUE ACKNOWLEDGEMENT — manual follow-up required",
        },
      },
    });
    if (mailErr) console.error("[PO-ESCALATION] logistics email failed:", mailErr.message ?? mailErr);
  }

  console.log(`[PO-ESCALATION] ${escalated.length} overdue purchase order(s)${dryRun ? " (dry run)" : ""}.`);
  return new Response(JSON.stringify({ dryRun, count: escalated.length, escalated }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
