import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const ADMIN_EMAILS = [
  "cyrille@maisonaffluency.com",
  "gregoire@maisonaffluency.com",
];

const FROM_ADDRESS = "Maison Affluency <noreply@notify.www.maisonaffluency.com>";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Only accept service-role bearer tokens
  const auth = req.headers.get("authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { event_id, event_type, user_id, table_name, columns, source, occurred_at } = body;

  const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

  const rows = (Array.isArray(columns) ? columns : [])
    .map((c: any) => {
      const col = typeof c === "string" ? { column: c } : c;
      return `<tr>
        <td style="padding:4px 8px;font-family:monospace;">${escapeHtml(col.column ?? "?")}</td>
        <td style="padding:4px 8px;">${escapeHtml(String(col.attempted ?? "—"))}</td>
        <td style="padding:4px 8px;">${escapeHtml(String(col.reverted_to ?? "—"))}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:Georgia,serif;max-width:640px;margin:0 auto;padding:32px;background:#faf9f7;">
      <h2 style="font-size:18px;color:#1a1a1a;margin:0 0 16px;">⚠ Pricing tamper attempt blocked</h2>
      <div style="background:#fff;border:1px solid #e8e5e0;border-radius:4px;padding:20px;">
        <p>A non-admin user attempted to modify protected pricing/tier columns. The changes were silently reverted.</p>
        <table style="border-collapse:collapse;font-size:13px;margin-top:12px;">
          <tr><td style="padding:4px 8px;"><strong>User</strong></td><td style="padding:4px 8px;font-family:monospace;">${escapeHtml(user_id ?? "anon")}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Table</strong></td><td style="padding:4px 8px;">${escapeHtml(table_name ?? "—")}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Source</strong></td><td style="padding:4px 8px;">${escapeHtml(source ?? "—")}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Event ID</strong></td><td style="padding:4px 8px;font-family:monospace;">${escapeHtml(event_id ?? "—")}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Time</strong></td><td style="padding:4px 8px;">${escapeHtml(occurred_at ?? new Date().toISOString())}</td></tr>
        </table>
        ${rows ? `<h3 style="font-size:14px;margin:16px 0 8px;">Attempted changes</h3>
          <table style="border-collapse:collapse;font-size:13px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:4px 8px;">Column</th>
                <th style="text-align:left;padding:4px 8px;">Attempted</th>
                <th style="text-align:left;padding:4px 8px;">Reverted to</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>` : ""}
        <p style="font-size:12px;color:#666;margin-top:16px;">Event type: ${escapeHtml(event_type ?? "pricing_tamper_attempt")} • Project: Maison Affluency</p>
      </div>
      <p style="font-size:11px;color:#999;margin-top:16px;text-align:center;">Maison Affluency — Automated security alert</p>
    </div>`;

  await Promise.allSettled(
    ADMIN_EMAILS.map((to) =>
      resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: `[Security] Pricing tamper attempt blocked on ${table_name ?? "unknown table"}`,
        html,
      })
    )
  );

  return new Response(JSON.stringify({ ok: true, event_id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
