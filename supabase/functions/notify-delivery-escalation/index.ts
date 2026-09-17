// Sends the procurement escalation email when a delivery line slips from
// Amber (<= 14 days slack) into Red (overdue).
//
// Invoked by the `public.trade_delivery_escalation` database trigger through
// pg_net with the vault-stored CRON_SECRET, so no user JWT is involved.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { sendLovableEmail } from "../_shared/lovableEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SITE_URL = "https://www.maisonaffluency.com";

const esc = (text: string): string =>
  text.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c)
  );

const fmtDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  try {
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const itemId: string | undefined = body?.item_id;
    if (!itemId || typeof itemId !== "string") return json({ error: "Missing item_id" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: item } = await admin
      .from("trade_quote_items")
      .select("id, quote_id, product_id, quantity, required_by_date, po_number")
      .eq("id", itemId)
      .maybeSingle();
    if (!item) return json({ error: "Item not found" }, 404);

    const [{ data: quote }, { data: product }] = await Promise.all([
      admin
        .from("trade_quotes")
        .select("id, user_id, studio_id, project_id, client_name")
        .eq("id", item.quote_id)
        .maybeSingle(),
      admin
        .from("trade_products")
        .select("product_name, brand_name")
        .eq("id", item.product_id)
        .maybeSingle(),
    ]);

    let projectName: string | null = null;
    if (quote?.project_id) {
      const { data: project } = await admin
        .from("projects")
        .select("name")
        .eq("id", quote.project_id)
        .maybeSingle();
      projectName = project?.name ?? null;
    }

    // Recipients: explicit list from the trigger, otherwise the quote owner.
    const recipientIds: string[] = Array.isArray(body?.recipient_ids) && body.recipient_ids.length
      ? body.recipient_ids
      : quote?.user_id
        ? [quote.user_id]
        : [];

    const { data: profiles } = recipientIds.length
      ? await admin.from("profiles").select("id, email, first_name").in("id", recipientIds)
      : { data: [] as { id: string; email: string | null; first_name: string | null }[] };

    const emails = [...new Set(((profiles as any[]) || [])
      .map((p) => (p.email || "").trim())
      .filter(Boolean))];
    if (!emails.length) return json({ ok: true, skipped: "no_recipient_email" });

    const quoteRef = `QU-${item.quote_id.slice(0, 6).toUpperCase()}`;
    const itemName = product?.product_name || "Item";
    const brandName = product?.brand_name || "";
    const trackerLink = `${SITE_URL}/trade/delivery-tracker?item=${item.id}&quote=${item.quote_id}`;
    const newSlack = typeof body?.new_slack === "number" ? body.new_slack : null;

    const row = (label: string, value: string, tone = "#333") =>
      `<tr>
        <td style="padding:6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.05em;width:150px;">${esc(label)}</td>
        <td style="padding:6px 0;font-size:14px;color:${tone};">${esc(value)}</td>
      </tr>`;

    const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#333;">
      <div style="border-bottom:1px solid #e0dcd5;padding-bottom:20px;margin-bottom:24px;">
        <p style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#b42318;margin:0 0 8px;">Delivery escalation — now late</p>
        <h1 style="font-size:22px;font-weight:normal;color:#1a1a1a;margin:0 0 4px;">${esc(itemName)}</h1>
        <p style="font-size:13px;color:#888;margin:0;">${esc(brandName)} · ${esc(quoteRef)}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${row("Project", projectName || "Unassigned")}
        ${row("Client", quote?.client_name || "—")}
        ${row("Item", itemName)}
        ${row("Brand", brandName || "—")}
        ${row("Quantity", String(item.quantity ?? 1))}
        ${row("PO number", item.po_number || "—")}
        ${row("Previous expected ready", fmtDate(body?.previous_expected))}
        ${row("New expected ready", fmtDate(body?.new_expected), "#b42318")}
        ${row("Required by", fmtDate(item.required_by_date), "#b42318")}
        ${row("Slack", newSlack == null ? "Overdue" : `${newSlack} days`, "#b42318")}
      </table>

      <div style="text-align:center;padding:16px 0;">
        <a href="${trackerLink}" style="display:inline-block;padding:10px 28px;background:#1a1a1a;color:#fff;text-decoration:none;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;border-radius:4px;">
          Open Delivery Tracker
        </a>
      </div>
      <p style="font-size:12px;color:#888;text-align:center;margin:0;">Quote ${esc(quoteRef)} · review the line drawer to reset the PO or lead time.</p>
    </div>`;

    const result = await sendLovableEmail({
      to: emails,
      subject: `Urgent: ${itemName}${brandName ? ` by ${brandName}` : ""} is now LATE`,
      html,
      label: "delivery-escalation",
      idempotencyKey: `delivery-escalation-${item.id}-${item.required_by_date ?? "none"}`,
    }, admin);

    return json({ ok: true, ...result });
  } catch (error) {
    console.error("notify-delivery-escalation error", error);
    return json({ error: (error as Error).message }, 500);
  }
});
