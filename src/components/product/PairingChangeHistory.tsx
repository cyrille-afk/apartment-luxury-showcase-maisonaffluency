import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { pairingHistoryChanges } from "@/lib/curatedPairingHistory";

export default function PairingChangeHistory({ products }: { products: { id: string; title: string; brand: string }[] }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const { data = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["curated-pairing-history", page], enabled: open,
    queryFn: async () => {
      const result = await supabase.from("curated_pairing_history").select("*").order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * 50, page * 50 + 50);
      if (result.error) throw result.error;
      return result.data;
    },
  });
  return <>
    <Button variant="outline" onClick={() => { setPage(0); setOpen(true); }}><History className="h-4 w-4" />Change history</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Catalog change history</DialogTitle><DialogDescription>Recorded from October 18, 2026. Times shown in your local time zone.</DialogDescription></DialogHeader>
      <div className="flex justify-end"><Button variant="ghost" size="icon" disabled={isFetching} aria-label="Refresh history" title="Refresh history" onClick={() => void refetch()}><RefreshCw className="h-4 w-4" /></Button></div>
      {error ? <p role="alert" className="text-destructive">Change history could not be loaded. Please retry.</p> : isLoading ? <p className="text-muted-foreground">Loading history…</p> : !data.length ? <p className="text-muted-foreground">No catalog changes recorded yet.</p> : <ol className="divide-y divide-border">{data.slice(0, 50).map((entry) => {
        const before = entry.before_values as Record<string, unknown> | null;
        const after = entry.after_values as Record<string, unknown> | null;
        const snapshot = after || before;
        const piece = products.find((product) => product.id === snapshot?.preferred_pick_id);
        const changes = pairingHistoryChanges(before, after).map((change) => change.field === "Preferred piece" ? { ...change, before: products.find((p) => p.id === change.before)?.title || change.before, after: products.find((p) => p.id === change.after)?.title || change.after } : change);
        return <li key={entry.id} className="space-y-3 py-5">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-medium text-foreground">{entry.action === "csv_import" ? `CSV import · ${entry.imported_count} pairings` : `${entry.action === "created" ? "Pairing created" : entry.action === "deleted" ? "Pairing removed" : "Pairing updated"}${entry.source === "csv" ? " · CSV" : ""}`}</h3>{snapshot && <p className="text-sm text-muted-foreground">{piece ? `${piece.brand} — ${piece.title}` : `${snapshot.source_category} → ${snapshot.target_category}`}</p>}{entry.file_name && <p className="break-all text-sm text-muted-foreground">{entry.file_name}</p>}</div><time className="text-xs text-muted-foreground" dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time></div>
          <p className="break-words text-sm">{entry.actor_name}{entry.actor_email && entry.actor_email !== entry.actor_name && <span className="text-muted-foreground"> · {entry.actor_email}</span>}</p>
          {!!changes.length && <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="pb-2">Change</th><th>Before</th><th>After</th></tr></thead><tbody>{changes.map((change, index) => <tr key={index}><td className="w-1/3 py-1 pr-3">{change.field}</td><td className="w-1/3 break-words pr-3">{change.before}</td><td className="w-1/3 break-words">{change.after}</td></tr>)}</tbody></table></div>}
          {entry.batch_id && <p className="text-xs text-muted-foreground">Import reference: {entry.batch_id}</p>}
        </li>;
      })}</ol>}
      <div className="flex items-center justify-between"><Button variant="outline" disabled={page === 0 || isFetching} onClick={() => setPage(page - 1)}>Newer</Button><span className="text-sm text-muted-foreground">Page {page + 1}</span><Button variant="outline" disabled={data.length <= 50 || isFetching} onClick={() => setPage(page + 1)}>Older</Button></div>
    </DialogContent></Dialog>
  </>;
}