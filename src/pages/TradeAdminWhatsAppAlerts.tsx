import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type AlertRow = {
  id: string;
  created_at: string;
  status: string | null;
  provider_message_id: string | null;
  error: string | null;
  payload: any;
};

type LiveStatus = {
  sid: string;
  status?: string | null;
  error_code?: number | null;
  error_message?: string | null;
  to?: string | null;
  date_sent?: string | null;
  error?: string;
};

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

function statusTone(status?: string | null, errorCode?: number | null) {
  if (errorCode) return "text-destructive";
  switch (status) {
    case "delivered":
    case "read":
      return "text-green-600";
    case "undelivered":
    case "failed":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

type DeliveryEvent = {
  id: string;
  message_sid: string;
  message_status: string | null;
  error_code: number | null;
  error_message: string | null;
  created_at: string;
};

export default function TradeAdminWhatsAppAlerts() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [live, setLive] = useState<Record<string, LiveStatus>>({});
  const [events, setEvents] = useState<Record<string, DeliveryEvent[]>>({});
  const [busy, setBusy] = useState(false);

  const loadEvents = useCallback(async (sids: string[]) => {
    if (!sids.length) return;
    const { data } = await supabase
      .from("whatsapp_delivery_events")
      .select("id, message_sid, message_status, error_code, error_message, created_at")
      .in("message_sid", sids)
      .order("created_at", { ascending: true });
    const map: Record<string, DeliveryEvent[]> = {};
    for (const e of (data ?? []) as DeliveryEvent[]) {
      (map[e.message_sid] ??= []).push(e);
    }
    setEvents(map);
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("admin_alert_log")
      .select("id, created_at, status, provider_message_id, error, payload")
      .eq("channel", "twilio_whatsapp")
      .eq("event", "quote_request")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast({ title: "Could not load alerts", description: error.message, variant: "destructive" });
      setBusy(false);
      return;
    }
    const list = (data ?? []) as AlertRow[];
    setRows(list);

    const sids = list.map((r) => r.provider_message_id).filter(Boolean) as string[];
    if (sids.length) {
      await loadEvents(sids);
      const { data: res, error: fnErr } = await supabase.functions.invoke("whatsapp-alert-status", {
        body: { sids },
      });
      if (fnErr) {
        toast({
          title: "Live delivery status unavailable",
          description: "Showing recorded status only.",
          variant: "destructive",
        });
      } else {
        const map: Record<string, LiveStatus> = {};
        for (const s of (res?.statuses ?? []) as LiveStatus[]) map[s.sid] = s;
        setLive(map);
      }
    }
    setBusy(false);
  }, [toast, loadEvents]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  // Real-time: new Twilio webhook events append to the history without a refresh.
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("whatsapp-delivery-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_delivery_events" },
        (payload) => {
          const e = payload.new as DeliveryEvent;
          setEvents((prev) => ({ ...prev, [e.message_sid]: [...(prev[e.message_sid] ?? []), e] }));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet>
        <title>WhatsApp Quote Alerts — Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-6xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-foreground">WhatsApp Quote Alerts</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Live Twilio delivery status for each quote request alert. Error code 63016 means the
              message was refused because it was sent outside WhatsApp's 24-hour reply window.
            </p>
          </div>
          <button
            onClick={load}
            disabled={busy}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 font-body text-xs uppercase tracking-[0.1em] text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {rows.length === 0 && !busy && (
          <p className="font-body text-sm text-muted-foreground">No quote alerts recorded yet.</p>
        )}

        <div className="space-y-3">
          {rows.map((r) => {
            const l = r.provider_message_id ? live[r.provider_message_id] : undefined;
            const status = l?.status ?? r.status ?? "unknown";
            return (
              <div key={r.id} className="rounded-lg border border-border p-4 font-body text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-foreground">
                    {r.payload?.product ?? r.payload?.message?.split("\n")?.[1] ?? "Quote request"}
                  </span>
                  <span className={`uppercase tracking-[0.12em] text-xs ${statusTone(status, l?.error_code)}`}>
                    {status}
                    {l?.error_code ? ` · error ${l.error_code}` : ""}
                  </span>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    <dt className="inline">Recipient: </dt>
                    <dd className="inline text-foreground">{l?.to ?? r.payload?.to ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline">Sent: </dt>
                    <dd className="inline text-foreground">{fmt(l?.date_sent ?? r.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="inline">Message SID: </dt>
                    <dd className="inline break-all text-foreground">{r.provider_message_id ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline">Path: </dt>
                    <dd className="inline text-foreground">
                      {r.payload?.used_template ? "Approved template" : "Plain message"}
                    </dd>
                  </div>
                  {(l?.error_message || r.error || l?.error) && (
                    <div className="sm:col-span-2 text-destructive">
                      {l?.error_message ?? l?.error ?? r.error}
                    </div>
                  )}
                </dl>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
