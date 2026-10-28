import { useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { priceDifferences, priceValue, durableAttemptRows, subscribePriceAttempts, getPriceAttempts, getServerPriceAttempts, matchesPriceHistoryFilter, priceHistoryCounts, PRICE_HISTORY_FILTER_LABELS, type DurablePriceAttempt, type PriceHistoryFilter, type PriceSnapshot } from "@/lib/adminPriceHistory";

type AuditRow = { id: string; created_at: string; old_data: PriceSnapshot; new_data: PriceSnapshot };
export default function AdminPriceHistory() {
  const { user, isAdmin, rolesLoaded } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(100);
  const [statusFilter, setStatusFilter] = useState<PriceHistoryFilter>("all");
  const attempts = useSyncExternalStore(subscribePriceAttempts, getPriceAttempts, getServerPriceAttempts);
  const history = useQuery({
    queryKey: ["admin-price-history", user?.id, limit], enabled: open && isAdmin && rolesLoaded,
    queryFn: async () => {
      const [audit, durable] = await Promise.all([
        supabase.from("content_audit_log").select("id,created_at,old_data,new_data")
          .eq("table_name", "designer_curator_picks").eq("operation", "UPDATE").order("created_at", { ascending: false }).limit(limit),
        supabase.from("admin_price_save_attempts").select("id,user_id,product_name,created_at,completed_at,status,old_data,new_data").order("created_at", { ascending: false }).limit(limit),
      ]);
      if (audit.error) throw audit.error;
      if (durable.error) throw durable.error;
      return { audit: (audit.data ?? []) as unknown as AuditRow[], attempts: (durable.data ?? []) as unknown as DurablePriceAttempt[] };
    },
  });
  if (!isAdmin || !rolesLoaded) return null;
  const saved = (history.data?.audit ?? []).flatMap((row) => {
    const changes = priceDifferences(row.old_data ?? {}, row.new_data ?? {});
    return changes.length ? [{ id: row.id, timestamp: row.created_at, product: row.new_data?.title ?? row.old_data?.title ?? "Deleted product", currency: row.new_data?.currency ?? row.old_data?.currency ?? "EUR", changes, status: "Saved" }] : [];
  });
  const local = attempts.filter((row) => row.userId === user?.id);
  const localIds = new Set(local.map((row) => row.id));
  const searched = [...local, ...durableAttemptRows(history.data?.attempts ?? []).filter((row) => !localIds.has(row.id)), ...saved].filter((row) => `${row.product} ${row.changes.map((change) => change.label).join(" ")}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const counts = priceHistoryCounts(searched);
  const rows = searched.filter((row) => matchesPriceHistoryFilter(row.status, statusFilter));
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}><History className="h-4 w-4" />Price history</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto" data-trade-sensitive>
        <DialogHeader><DialogTitle className="font-display text-xl">Price change history</DialogTitle></DialogHeader>
        <div className="flex items-center gap-3">
          <Input aria-label="Search price history" placeholder="Search products or finishes" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button variant="outline" size="icon" aria-label="Refresh price history" disabled={history.isFetching} onClick={() => void history.refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        <div role="group" aria-label="Filter price changes by save status" className="flex flex-wrap items-center gap-2">
          {(["all", "saved", "pending", "failed"] as const).map((filter) => (
            <Button key={filter} size="sm" variant={statusFilter === filter ? "default" : "outline"} aria-pressed={statusFilter === filter} onClick={() => setStatusFilter(filter)}>
              {PRICE_HISTORY_FILTER_LABELS[filter]}<span className="ml-2 tabular-nums text-xs opacity-70">{counts[filter]}</span>
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Account history · Times in {Intl.DateTimeFormat().resolvedOptions().timeZone}. Interrupted saves remain unconfirmed.</p>
        {history.isError && <div className="text-sm text-destructive" role="alert">Saved history could not be loaded. Try refreshing.</div>}
        {history.isLoading ? <p className="text-sm text-muted-foreground">Loading saved changes…</p> : <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead className="border-b border-border text-left text-xs text-muted-foreground"><tr>{["Product / finish", "Previous price", "New price", "Save status", "Timestamp"].map((label) => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody>{rows.flatMap((row) => row.changes.map((change, index) => <tr key={`${row.id}-${index}`} className="border-b border-border align-top">
              <td className="px-3 py-3 min-w-52"><div className="font-display">{row.product}</div><div className="text-xs text-muted-foreground mt-1">{change.label}</div></td>
              <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{priceValue(change.before, row.currency)}</td><td className="px-3 py-3 whitespace-nowrap">{priceValue(change.after, row.currency)}</td>
              <td className={`px-3 py-3 whitespace-nowrap ${row.status === "Failed" ? "text-destructive" : matchesPriceHistoryFilter(row.status, "pending") ? "text-muted-foreground" : "text-foreground"}`}>{row.status}</td>
              <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">{new Date(row.timestamp).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium" })}</td>
            </tr>))}</tbody>
          </table>
          {!rows.length && !history.isError && <p className="py-8 text-sm text-muted-foreground">{statusFilter === "all" ? "No price changes found." : `No ${PRICE_HISTORY_FILTER_LABELS[statusFilter].toLowerCase()} price changes.`}</p>}
        </div>}
        {Math.max(history.data?.audit.length ?? 0, history.data?.attempts.length ?? 0) >= limit && <Button variant="outline" onClick={() => setLimit((value) => value + 100)}>Load older records</Button>}
      </DialogContent>
    </Dialog>
  </>;
}