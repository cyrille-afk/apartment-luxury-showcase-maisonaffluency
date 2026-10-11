import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Report = {
  endpoints: { url: string; status: string; events: string[]; matchesApp: boolean }[];
  events: { id: string; type: string; pending: number; created: number; received: boolean }[];
  lastReceived: { event_id: string; event_type: string; created_at: string } | null;
};

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-test-ping`;

async function call(method: "GET" | "POST") {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(method === "GET" ? `${FN}?inspect=1` : FN, {
    method,
    headers: {
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body;
}

export function WebhookDeliveryStatus() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState<"check" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const check = async () => {
    setBusy("check"); setError(null);
    try { setReport(await call("GET")); } catch (e) { setError((e as Error).message); }
    setBusy(null);
  };

  const sendTest = async () => {
    setBusy("send"); setError(null); setNote(null);
    try {
      const pi = await call("POST");
      setNote(`Test payment ${pi.id} ${pi.status}. Checking delivery in 8 seconds…`);
      await new Promise((r) => setTimeout(r, 8000));
      setReport(await call("GET"));
      setNote(null);
    } catch (e) { setError((e as Error).message); }
    setBusy(null);
  };

  const appEndpoint = report?.endpoints.find((e) => e.matchesApp);

  return (
    <section className="mt-6 rounded-sm border border-border bg-card p-6">
      <h2 className="font-display text-xl">Webhook delivery status (Test mode)</h2>
      <p className="mt-2 font-body text-sm text-muted-foreground">
        Compares Stripe's recent test events with what this app has received.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" className="font-body text-xs" onClick={check} disabled={!!busy}>
          {busy === "check" ? "Checking…" : "Check delivery"}
        </Button>
        <Button variant="outline" className="font-body text-xs" onClick={sendTest} disabled={!!busy}>
          {busy === "send" ? "Sending…" : "Send €1 test payment"}
        </Button>
      </div>
      {note && <p className="mt-3 font-body text-xs text-muted-foreground">{note}</p>}
      {error && <p className="mt-3 font-body text-xs text-destructive">Check failed: {error}</p>}
      {report && (
        <div className="mt-4 space-y-3 font-body text-sm">
          <p>
            Stripe destination for this app:{" "}
            {appEndpoint ? (
              <span className="text-foreground">found ({appEndpoint.status}, {appEndpoint.events.length} events)</span>
            ) : (
              <span className="text-destructive">
                not found in Test mode{report.endpoints.length ? ` (${report.endpoints.length} other destination(s))` : ""}
              </span>
            )}
          </p>
          <p className="text-muted-foreground">
            Last event received by app:{" "}
            {report.lastReceived
              ? `${report.lastReceived.event_type} · ${new Date(report.lastReceived.created_at).toLocaleString()}`
              : "none"}
          </p>
          <ul className="divide-y divide-border rounded-sm border border-border">
            {report.events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span className="font-mono">{e.type}</span>
                <span className="text-muted-foreground">{new Date(e.created * 1000).toLocaleString()}</span>
                <span className={e.received ? "text-foreground" : "text-destructive"}>
                  {e.received ? "Received" : e.pending > 0 ? "Pending delivery" : "Not delivered"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
