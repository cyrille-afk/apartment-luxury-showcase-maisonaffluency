import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyHistoryFilters, filterPairingHistory, historyMediaChanges, historySnapshot, type HistoryFilters } from "@/lib/pairingHistoryFilters";
import type { Tables } from "@/integrations/supabase/types";

export default function PairingChangeHistory({ products }: { products: { id: string; title: string; brand: string }[] }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<HistoryFilters>({ ...emptyHistoryFilters });
  const changeFilter = (key: keyof HistoryFilters, value: string) => { setFilters(current => ({ ...current, [key]: value })); setPage(0); };
  const { data = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["curated-pairing-history", "filterable"], enabled: open,
    queryFn: async () => {
      const entries: Tables<"curated_pairing_history">[] = [];
      for (let offset = 0; ; offset += 1000) {
        const result = await supabase.from("curated_pairing_history").select("*").order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 999);
        if (result.error) throw result.error;
        entries.push(...result.data);
        if (result.data.length < 1000) return entries;
      }
    },
  });
  const matching = filterPairingHistory(data, filters);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(matching.length / 50) - 1));
  const visible = matching.slice(currentPage * 50, (currentPage + 1) * 50);
  const active = Object.entries(filters).some(([key, value]) => value !== emptyHistoryFilters[key as keyof HistoryFilters]);
  const admins = Array.from(new Map(data.map(entry => [entry.actor_id || "unknown", { id: entry.actor_id || "unknown", name: entry.actor_name, email: entry.actor_email }])).values()).sort((a, b) => a.name.localeCompare(b.name));
  const historicalIds = new Set(data.flatMap(entry => [historySnapshot(entry.before_values)?.preferred_pick_id, historySnapshot(entry.after_values)?.preferred_pick_id]).filter((id): id is string => typeof id === "string"));
  const productOptions = [...products, ...Array.from(historicalIds).filter(id => !products.some(product => product.id === id)).map(id => ({ id, title: `Removed product · ${id}`, brand: "" }))].sort((a, b) => a.title.localeCompare(b.title));
  const invalidDates = !!filters.from && !!filters.to && filters.from > filters.to;
  return <>
    <Button variant="outline" onClick={() => { setPage(0); setOpen(true); }}><History className="h-4 w-4" />Change history</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Catalog change history</DialogTitle><DialogDescription>Recorded from October 18, 2026. Times shown in your local time zone.</DialogDescription></DialogHeader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1"><Label htmlFor="history-product">Product</Label><Select value={filters.product} onValueChange={value => changeFilter("product", value)}><SelectTrigger id="history-product" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All products</SelectItem>{productOptions.map(product => <SelectItem key={product.id} value={product.id}>{product.brand ? `${product.brand} — ` : ""}{product.title}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label htmlFor="history-admin">Admin</Label><Select value={filters.admin} onValueChange={value => changeFilter("admin", value)}><SelectTrigger id="history-admin"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All admins</SelectItem>{admins.map(admin => <SelectItem key={admin.id} value={admin.id}>{admin.name}{admin.email && admin.email !== admin.name ? ` · ${admin.email}` : ""}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label htmlFor="history-media">Change type</Label><Select value={filters.media} onValueChange={value => changeFilter("media", value)}><SelectTrigger id="history-media"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All changes</SelectItem><SelectItem value="images">Finish images & textures</SelectItem><SelectItem value="photos">Finish images</SelectItem><SelectItem value="textures">Macro textures</SelectItem></SelectContent></Select></div>
        <div className="space-y-1"><Label htmlFor="history-from">From date</Label><Input id="history-from" type="date" value={filters.from} max={filters.to || undefined} onChange={event => changeFilter("from", event.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="history-to">To date</Label><Input id="history-to" type="date" value={filters.to} min={filters.from || undefined} onChange={event => changeFilter("to", event.target.value)} /></div>
      </div>
      {invalidDates && <p role="alert" className="text-sm text-destructive">The end date must be on or after the start date.</p>}
      <div className="flex items-center justify-between gap-2"><span aria-live="polite" className="text-sm text-muted-foreground">{isLoading ? "Loading history…" : `${matching.length} matching ${matching.length === 1 ? "record" : "records"}`}</span><div className="flex items-center gap-2">{active && <Button variant="ghost" onClick={() => { setFilters({ ...emptyHistoryFilters }); setPage(0); }}>Clear filters</Button>}<Button variant="ghost" size="icon" disabled={isFetching} aria-label="Refresh history" title="Refresh history" onClick={() => void refetch()}><RefreshCw className="h-4 w-4" /></Button></div></div>
      {error ? <p role="alert" className="text-destructive">Change history could not be loaded. Please retry.</p> : isLoading ? <p className="text-muted-foreground">Loading history…</p> : !matching.length ? <p className="text-muted-foreground">{active ? "No changes match these filters." : "No catalog changes recorded yet."}</p> : <ol className="divide-y divide-border">{visible.map((entry) => {
        const before = historySnapshot(entry.before_values);
        const after = historySnapshot(entry.after_values);
        const snapshot = after || before;
        const piece = products.find((product) => product.id === snapshot?.preferred_pick_id);
        const changes = historyMediaChanges(before, after, filters.media).map((change) => change.field === "Preferred piece" ? { ...change, before: products.find((p) => p.id === change.before)?.title || change.before, after: products.find((p) => p.id === change.after)?.title || change.after } : change);
        return <li key={entry.id} className="space-y-3 py-5">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-medium text-foreground">{entry.action === "csv_import" ? `CSV import · ${entry.imported_count} pairings` : `${entry.action === "created" ? "Pairing created" : entry.action === "deleted" ? "Pairing removed" : "Pairing updated"}${entry.source === "csv" ? " · CSV" : ""}`}</h3>{snapshot && <p className="text-sm text-muted-foreground">{piece ? `${piece.brand} — ${piece.title}` : `${snapshot.source_category} → ${snapshot.target_category}`}</p>}{entry.file_name && <p className="break-all text-sm text-muted-foreground">{entry.file_name}</p>}</div><time className="text-xs text-muted-foreground" dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time></div>
          <p className="break-words text-sm">{entry.actor_name}{entry.actor_email && entry.actor_email !== entry.actor_name && <span className="text-muted-foreground"> · {entry.actor_email}</span>}</p>
          {!!changes.length && <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="pb-2">Change</th><th>Before</th><th>After</th></tr></thead><tbody>{changes.map((change, index) => <tr key={index}><td className="w-1/3 py-1 pr-3">{change.field}{change.action && <span className="block text-xs text-muted-foreground">{change.action}</span>}</td><td className="w-1/3 break-all pr-3">{change.before}</td><td className="w-1/3 break-all">{change.after}</td></tr>)}</tbody></table></div>}
          {entry.batch_id && <p className="text-xs text-muted-foreground">Import reference: {entry.batch_id}</p>}
        </li>;
      })}</ol>}
      <div className="flex items-center justify-between"><Button variant="outline" disabled={currentPage === 0 || isFetching} onClick={() => setPage(currentPage - 1)}>Newer</Button><span className="text-sm text-muted-foreground">Page {currentPage + 1}</span><Button variant="outline" disabled={(currentPage + 1) * 50 >= matching.length || isFetching} onClick={() => setPage(currentPage + 1)}>Older</Button></div>
    </DialogContent></Dialog>
  </>;
}