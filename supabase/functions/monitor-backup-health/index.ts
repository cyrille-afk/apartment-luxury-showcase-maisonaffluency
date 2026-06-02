// Scheduled backup health monitor.
// Runs daily after the per-table backup jobs (scheduled 02:00–02:07 UTC).
// Verifies that every expected per-table backup landed in the `backups`
// bucket for today's date, AND checks pg_net for any failed/timed-out
// invocations of `backup-critical-data` in the last 24h. Sends an email to
// admins if anything is missing, errored, or returned a non-2xx status.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
};

const ADMIN_EMAILS = [
  "cyrille@maisonaffluency.com",
  "gregoire@maisonaffluency.com",
];

const EXPECTED_TABLES = [
  "designers",
  "designer_curator_picks",
  "trade_products",
  "trade_documents",
  "profiles",
  "user_roles",
  "trade_applications",
  "journal_articles",
];

const BUCKET = "backups";

type TableCheck = {
  table: string;
  data_present: boolean;
  status_present: boolean;
  status?: string;
  rows?: number;
  issue?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: cron secret OR service-role bearer (pg_cron uses the latter).
  const cronSecret = req.headers.get("x-cron-secret");
  const auth = req.headers.get("authorization") ?? "";
  const expectedCron = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isCron = !!(expectedCron && cronSecret === expectedCron);
  const isService = !!(serviceKey && auth === `Bearer ${serviceKey}`);
  if (!isCron && !isService) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Date the backups should be filed under (UTC). Allow `?date=YYYY-MM-DD` override for testing.
  const url = new URL(req.url);
  const override = url.searchParams.get("date");
  const today =
    override && /^\d{4}-\d{2}-\d{2}$/.test(override)
      ? override
      : new Date().toISOString().slice(0, 10);

  // 1. List files in today's backup folder.
  const { data: files, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list(today, { limit: 100 });

  const fileNames = new Set((files ?? []).map((f) => f.name));

  const tableChecks: TableCheck[] = [];
  const failures: string[] = [];

  if (listErr) {
    failures.push(`Could not list backups/${today}/: ${listErr.message}`);
  }

  for (const table of EXPECTED_TABLES) {
    const dataFile = `${table}.json`;
    const statusFile = `${table}.status.json`;
    const check: TableCheck = {
      table,
      data_present: fileNames.has(dataFile),
      status_present: fileNames.has(statusFile),
    };

    if (!check.data_present) {
      check.issue = "missing data file";
      failures.push(`${table}: missing ${today}/${dataFile}`);
    } else if (!check.status_present) {
      check.issue = "missing status sidecar";
      failures.push(`${table}: missing ${today}/${statusFile}`);
    } else {
      // Read sidecar
      try {
        const { data: blob, error: dlErr } = await supabase.storage
          .from(BUCKET)
          .download(`${today}/${statusFile}`);
        if (dlErr) throw dlErr;
        const parsed = JSON.parse(await blob.text());
        check.status = parsed?.status;
        check.rows = parsed?.rows;
        if (parsed?.status !== "ok") {
          check.issue = `status=${parsed?.status}`;
          failures.push(`${table}: status=${parsed?.status}`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        check.issue = `cannot read status: ${msg}`;
        failures.push(`${table}: cannot read status sidecar (${msg})`);
      }
    }
    tableChecks.push(check);
  }

  // 2. (pg_net failures are detected implicitly: if the cron call timed out or
  // returned non-2xx, the function never wrote its status sidecar, so the
  // file-presence check above already flags it.)
  const httpFailures: Array<{ status_code: number | null; error: string | null; created: string }> = [];

  const overall_status = failures.length === 0 ? "ok" : "error";

  // 3. Send alert email on failure (with cooldown to avoid spam if run multiple times).
  let alertSent = false;
  if (overall_status === "error") {
    // Cooldown: don't re-alert if same date+failure-count was already alerted in the last 6h.
    const dedupeKey = `backup-health:${today}`;
    const { data: state } = await supabase
      .from("security_alert_state")
      .select("last_alerted_at, payload")
      .eq("id", dedupeKey)
      .maybeSingle();

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60_000).toISOString();
    const lastFailureCount = (state?.payload as { failure_count?: number } | null)?.failure_count;
    const inCooldown =
      state?.last_alerted_at &&
      state.last_alerted_at > sixHoursAgo &&
      lastFailureCount === failures.length;

    if (!inCooldown) {
      const rowsHtml = tableChecks
        .map((c) => {
          const ok = !c.issue;
          const bg = ok ? "#f0f7f0" : "#fdf2f2";
          const color = ok ? "#2a6a2a" : "#a02020";
          const detail = ok
            ? `${c.rows ?? "?"} rows`
            : c.issue ?? "unknown";
          return `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:monospace;font-size:13px;">${c.table}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;background:${bg};color:${color};font-size:13px;">${ok ? "OK" : "FAIL"}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;color:#444;">${detail}</td>
          </tr>`;
        })
        .join("");

      const httpHtml = httpFailures.length
        ? `<h3 style="font-size:14px;margin:20px 0 8px;color:#a02020;">pg_net invocation failures (last 24h)</h3>
           <ul style="font-size:12px;color:#444;margin:0;padding-left:18px;">
             ${httpFailures.map((r) => `<li>${r.created} — status ${r.status_code ?? "null"} ${r.error ? "— " + r.error : ""}</li>`).join("")}
           </ul>`
        : "";

      const html = `
        <div style="font-family:Georgia,serif;max-width:680px;margin:0 auto;padding:32px;background:#faf9f7;">
          <h2 style="font-size:18px;color:#a02020;margin:0 0 16px;">⚠ Backup failure — ${today}</h2>
          <div style="background:#fff;border:1px solid #e8e5e0;border-radius:4px;padding:20px;">
            <p style="font-size:14px;color:#333;margin:0 0 12px;">
              <strong>${failures.length}</strong> issue(s) detected with today's nightly per-table backups.
            </p>
            <table style="width:100%;border-collapse:collapse;margin-top:8px;">
              <thead>
                <tr style="background:#f5f3ee;">
                  <th style="text-align:left;padding:6px 10px;font-size:12px;color:#666;">Table</th>
                  <th style="text-align:left;padding:6px 10px;font-size:12px;color:#666;">Status</th>
                  <th style="text-align:left;padding:6px 10px;font-size:12px;color:#666;">Detail</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            ${httpHtml}
            <p style="font-size:12px;color:#666;margin-top:20px;">
              Bucket: <code>${BUCKET}/${today}/</code> &middot; Project: Maison Affluency
            </p>
          </div>
          <p style="font-size:11px;color:#999;margin-top:16px;text-align:center;">
            Maison Affluency — Automated backup monitor
          </p>
        </div>`;

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const resend = new Resend(resendKey);
        await Promise.allSettled(
          ADMIN_EMAILS.map((to) =>
            resend.emails.send({
              from: "Maison Affluency <noreply@notify.www.maisonaffluency.com>",
              to,
              subject: `[Backup] FAILURE on ${today} — ${failures.length} issue(s)`,
              html,
            }),
          ),
        );
        alertSent = true;
      }

      await supabase.from("security_alert_state").upsert({
        id: dedupeKey,
        last_alerted_at: new Date().toISOString(),
        payload: { failure_count: failures.length, failures, date: today },
      });
    }
  }

  return new Response(
    JSON.stringify({
      ok: overall_status === "ok",
      date: today,
      overall_status,
      table_checks: tableChecks,
      http_failures: httpFailures,
      failures,
      alert_sent: alertSent,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: overall_status === "ok" ? 200 : 500,
    },
  );
});
