// Procurement escalation email: fires when a delivery line slips from
// Amber (<= 14 days slack) into Red (overdue).
//
// The in-app notifications are produced by the `trade_emit_delivery_escalation`
// database trigger; this function only handles the email side and re-verifies
// the escalation server-side before sending anything.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { sendLovableEmail } from "../_shared/lovableEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const { data: claimsData, error: authError } = await anon.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
    if (authError || !userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const itemId: string | undefined = body?.item_id;
    if (!itemId || typeof itemId !== "string") return json({ error: "Missing item_id" }, 400);
    const previousSlack: number | null =
      typeof body?.previous_slack === "number" ? body.previous_slack : null;

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

    const { data: quote } = await admin
      .from("trade_quotes")
      .select("id, user_id, studio_id, project_id, client_name")
      .eq("id", item.quote_id)
      .maybeSingle();
    if (!quote) return json({ error: "Quote not found" }, 404);

    // Caller must own the quote or belong to its studio.
    let allowed = quote.user_id === userId;
    if (!allowed && quote.studio_id) {
      const { data: membership } = await admin
        .from("studio_members")
        .select("user_id")
        .eq("studio_id", quote.studio_id)
        .eq("user_id", userId)
        .maybeSingle();
      allowed = !!membership;
    }
    if (!allowed) return json({ error: "Forbidden" }, 403);

    // Re-verify the escalation from live data.
    const { data: statusRows } = await admin.rpc("trade_item_delivery_status", {
      p_item_id: itemId,
    });
    const status = Array.isArray(statusRows) ? statusRows[0] : statusRows;
    const newSlack: number | null = typeof status?.slack === "number" ? status.slack : null;
    if (newSlack == null || newSlack >= 0) {
      return json({ ok: true, skipped: "not_late", slack: newSlack });
    }
    if (previousSlack != null && (previousSlack < 0 || previousSlack > 14)) {
      return json({ ok: true, skipped: "not_amber_to_red" });
    }

    const { data: product } = await admin
      .from("trade_products")
      .select("product_name, brand_name")
      .eq("id", item.product_id)
      .maybeSingle();

    let projectName: string | null = null;
    if (quote.project_id) {
      const { data: project } = await admin
        .from("projects")
        .select("name")
        .eq("id", quote.project_id)
        .maybeSingle();
      projectName = (project as { name?: string } | null)?.name ?? null;
    }

    // Procurement recipients: quote owner + studio owners/admins/editors.
    const recipientIds = new Set<string>();
    if (quote.user_id) recipientIds.add(quote.user_id);
    if (quote.studio_id) {
      const { data: members } = await admin
        .from("studio_members")
        .select("user_id, role")
        .eq("studio_id", quote.studio_id)
        .in("role", ["owner", "admin", "editor"]);
      for (const m of (members as { user_id: string }[]) || []) recipientIds.add(m.user_id);
    }

    const { data: profiles } = recipientIds.size
      ? await admin.from("profiles").select("id, email").in("id", [...recipientIds])
      : { data: [] as { id: string; email: string | null }[] };

    const emails = [...new Set(((profiles as { email: string | null }[]) || [])
      .map((p) => (p.email || "").trim())
      .filter(Boolean))];
    if (!emails.length) return json({ ok: true, skipped: "no_recipient_email" });

    const quoteRef = `QU-${item.quote_id.slice(0, 6).toUpperCase()}`;
    const itemName = product?.product_name || "Item";
    const brandName = product?.brand_name || "";
    const trackerLink = `${SITE_URL}/trade/delivery-tracker?item=${item.id}&quote=${item.quote_id}`;

    const row = (label: string, value: string, tone = "#333") =>
      `<tr>
        <td style="padding:6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.05em;width:170px;">${esc(label)}</td>
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
        ${row("Client", quote.client_name || "—")}
        ${row("Item", itemName)}
        ${row("Brand", brandName || "—")}
        ${row("Quantity", String(item.quantity ?? 1))}
        ${row("PO number", item.po_number || "—")}
        ${row("Previous expected ready", fmtDate(body?.previous_expected))}
        ${row("New expected ready", fmtDate(status?.expected), "#b42318")}
        ${row("Required by", fmtDate(item.required_by_date), "#b42318")}
        ${row("Status", `${Math.abs(newSlack)} days overdue`, "#b42318")}
      </table>

      <div style="text-align:center;padding:16px 0;">
        <a href="${trackerLink}" style="display:inline-block;padding:10px 28px;background:#1a1a1a;color:#fff;text-decoration:none;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;border-radius:4px;">
          Open Delivery Tracker
        </a>
      </div>
      <p style="font-size:12px;color:#888;text-align:center;margin:0;">Quote ${esc(quoteRef)} · open the line drawer to reset the PO, lead time or required-by date.</p>
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
