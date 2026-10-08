/** Admin-only deliverability check for admin alerts and internal copies. RLS is the control. */
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import {
  buildRecipientReports, isAdminAlertTemplate, type SendLogRow, type SuppressionRow, type Verdict,
} from "@/lib/emailDeliverability";

const VERDICT: Record<Verdict, { label: string; hint: string; variant: "destructive" | "secondary" | "outline" | "default" }> = {
  spam_complaint: { label: "Marked as spam", hint: "Recipient reported an email as spam; further sends are blocked.", variant: "destructive" },
  bouncing: { label: "Bouncing", hint: "Mailbox rejected delivery; sends are blocked until the address is fixed.", variant: "destructive" },
  blocked: { label: "Blocked", hint: "Address is on the block list (e.g. unsubscribed); emails are not sent.", variant: "destructive" },
  failing: { label: "Failing", hint: "Latest email failed after retries.", variant: "destructive" },
  stuck: { label: "Stuck in queue", hint: "Queued for over 15 minutes without sending.", variant: "secondary" },
  healthy: { label: "Delivered", hint: "Accepted by the recipient's mail server. If not seen, check spam/junk or mail filters.", variant: "outline" },
};

const DAYS = [7, 30, 90];

export default function TradeAdminEmailDeliverability() {
  const { user, isAdmin, rolesLoaded } = useAuth();
  const [days, setDays] = useState(30);
  const enabled = !!user && isAdmin;

  const q = useQuery({
    queryKey: ["email-deliverability", days],
    enabled,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 864e5).toISOString();
      const [logs, sup] = await Promise.all([
        supabase.from("email_send_log")
          .select("message_id,template_name,recipient_email,status,error_message,created_at")
          .gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
        supabase.from("suppressed_emails").select("email,reason,created_at"),
      ]);
      if (logs.error) throw logs.error;
      if (sup.error) throw sup.error;
      return {
        rows: (logs.data as SendLogRow[]).filter((r) => isAdminAlertTemplate(r.template_name)),
        suppressions: sup.data as SuppressionRow[],
      };
    },
  });

  const reports = useMemo(() => (q.data ? buildRecipientReports(q.data.rows, q.data.suppressions) : []), [q.data]);
  const issues = reports.filter((r) => r.verdict !== "healthy").length;

  if (!rolesLoaded) return <div className="p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!enabled) return <div className="p-10 text-muted-foreground">Admins only.</div>;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Helmet><title>Alert Email Deliverability · Admin</title><meta name="robots" content="noindex" /></Helmet>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl">Alert email deliverability</h1>
          <p className="text-sm text-muted-foreground max-w-2xl mt-1">
            Every recipient of admin alerts and internal copies, with bounces, spam complaints, blocks, failures and stuck sends.
            "Delivered" means the receiving server accepted it — inbox vs spam folder placement can't be seen from here.
          </p>
        </div>
        <div className="flex gap-2">
          {DAYS.map((d) => (
            <Button key={d} size="sm" variant={d === days ? "default" : "outline"} onClick={() => setDays(d)}>{d} days</Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => q.refetch()} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : q.error ? (
        <p className="text-destructive">Could not load: {(q.error as Error).message}</p>
      ) : (
        <>
          <p className="text-sm mb-4">{reports.length} recipients · <strong>{issues}</strong> with issues</p>
          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Recipient</th><th className="p-3">Status</th>
                  <th className="p-3 text-right">Sent</th><th className="p-3 text-right">Failed</th>
                  <th className="p-3 text-right">Blocked</th><th className="p-3">Last delivered</th><th className="p-3">Detail</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.email} className="border-t border-border align-top">
                    <td className="p-3"><div className="font-medium">{r.email}</div><div className="text-xs text-muted-foreground">{r.templates.join(", ")}</div></td>
                    <td className="p-3"><Badge variant={VERDICT[r.verdict].variant} title={VERDICT[r.verdict].hint}>{VERDICT[r.verdict].label}</Badge></td>
                    <td className="p-3 text-right">{r.sent}</td>
                    <td className="p-3 text-right">{r.failed}</td>
                    <td className="p-3 text-right">{r.suppressed}</td>
                    <td className="p-3 whitespace-nowrap">{r.lastSentAt ? new Date(r.lastSentAt).toLocaleString() : "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground max-w-xs">
                      {VERDICT[r.verdict].hint}
                      {r.suppressionReason && <div>Block reason: {r.suppressionReason}</div>}
                      {r.lastError && <div className="text-destructive break-words">Error: {r.lastError}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
