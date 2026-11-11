import { useQuery } from "@tanstack/react-query";
import { History, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";

const labels: Record<string, string> = {
  pricing_saved: "Pricing saved",
  changes_requested: "Changes requested",
  revision_created: "Editable revision created",
};

export function QuoteAuditTimeline({ quoteId }: { quoteId: string }) {
  const history = useQuery({
    queryKey: ["quote-audit", quoteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_quote_audit_timeline", { _quote_id: quoteId });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
  });

  return (
    <section data-trade-sensitive className="border-t border-border py-6 print:hidden" aria-label="Quote audit timeline">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-body text-xs uppercase text-muted-foreground"><History className="h-4 w-4" />Audit timeline</h3>
        <Button variant="ghost" size="icon" title="Refresh audit timeline" aria-label="Refresh audit timeline" disabled={history.isFetching} onClick={() => void history.refetch()}><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>
      {history.isPending ? <p className="font-body text-xs text-muted-foreground" role="status">Loading history…</p> : history.isError ? (
        <p className="font-body text-xs text-destructive" role="alert">History could not be loaded. Please try refreshing.</p>
      ) : history.data.length === 0 ? (
        <p className="font-body text-xs text-muted-foreground">No recorded actions yet.</p>
      ) : (
        <ol className="space-y-5 border-l border-border pl-4">
          {history.data.map(event => (
            <li key={event.id} className="font-body text-xs">
              <p className="font-medium text-foreground">{labels[event.action] ?? event.action}</p>
              <p className="mt-1 break-words text-muted-foreground">{event.actor_name} · <time dateTime={event.occurred_at}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(event.occurred_at))} UTC</time></p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                <Link to={`/trade/quotes?quote=${event.quote_id}`} className="underline underline-offset-4">QU-{event.quote_id.slice(0, 6).toUpperCase()}</Link>
                {event.related_quote_id && <Link to={`/trade/quotes?quote=${event.related_quote_id}`} className="underline underline-offset-4">{event.action === "revision_created" ? "Original" : "Revision"}: QU-{event.related_quote_id.slice(0, 6).toUpperCase()}</Link>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}