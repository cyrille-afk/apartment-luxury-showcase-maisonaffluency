import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Play, Upload, RefreshCw, Trash2 } from "lucide-react";

interface QueueRow {
  id: string;
  source_url: string;
  status: "pending" | "processing" | "completed" | "failed";
  error_message: string | null;
  attempts: number;
  created_at: string;
}

interface ParsedItem {
  source_url: string;
  raw_data: Record<string, unknown>;
}

/** Accepts a JSON array of objects, or a newline-separated list of URLs. */
function parseInput(text: string): { items: ParsedItem[]; errors: string[] } {
  const trimmed = text.trim();
  const errors: string[] = [];
  if (!trimmed) return { items: [], errors: ["Nothing to import."] };

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (e) {
      return { items: [], errors: [`Invalid JSON: ${(e as Error).message}`] };
    }
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const items: ParsedItem[] = [];
    arr.forEach((entry, i) => {
      if (typeof entry === "string") {
        items.push({ source_url: entry.trim(), raw_data: {} });
        return;
      }
      if (!entry || typeof entry !== "object") {
        errors.push(`Item ${i + 1}: not an object`);
        return;
      }
      const obj = entry as Record<string, unknown>;
      const url =
        (typeof obj.source_url === "string" && obj.source_url) ||
        (typeof obj.url === "string" && obj.url) ||
        (typeof obj.sku === "string" && `sku:${obj.sku}`) ||
        "";
      if (!url) {
        errors.push(`Item ${i + 1}: missing source_url / url / sku`);
        return;
      }
      items.push({ source_url: String(url).trim(), raw_data: obj });
    });
    return { items, errors };
  }

  const items = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((url) => ({ source_url: url, raw_data: {} }));
  return { items, errors };
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  processing: "bg-sky-500",
  completed: "bg-emerald-600",
  failed: "bg-red-600",
};

export default function TradeIngestionQueue() {
  const { user, isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [batchSize, setBatchSize] = useState(20);

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["ingestion-queue"],
    enabled: !!user && isAdmin,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingestion_queue")
        .select("id, source_url, status, error_message, attempts, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as QueueRow[];
    },
  });

  const counts = useMemo(() => {
    const c = { pending: 0, processing: 0, completed: 0, failed: 0 };
    rows.forEach((r) => {
      c[r.status] = (c[r.status] ?? 0) + 1;
    });
    return c;
  }, [rows]);

  const total = rows.length || 1;

  const enqueue = useMutation({
    mutationFn: async () => {
      const { items, errors } = parseInput(input);
      if (errors.length) toast.warning(errors.slice(0, 3).join(" · "));
      if (!items.length) throw new Error("No valid items found");
      const { error, count } = await supabase
        .from("ingestion_queue")
        .upsert(
          items.map((i) => ({
            source_url: i.source_url,
            raw_data: i.raw_data as never,
            status: "pending",
            error_message: null,
            attempts: 0,
          })),
          { onConflict: "source_url", count: "exact" },
        );
      if (error) throw error;
      return count ?? items.length;
    },
    onSuccess: (n) => {
      toast.success(`Queued ${n} item(s)`);
      setInput("");
      qc.invalidateQueries({ queryKey: ["ingestion-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runBatch = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-ingestion-queue", {
        body: { batch_size: batchSize },
      });
      if (error) throw error;
      return data as Record<string, unknown>;
    },
    onSuccess: (d) => {
      if (d?.skipped) toast.info(`Skipped: ${d.skipped}`);
      else toast.success(`Processed ${d?.processed ?? 0} · ${d?.succeeded ?? 0} ok · ${d?.failed ?? 0} failed`);
      qc.invalidateQueries({ queryKey: ["ingestion-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retryFailed = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("ingestion_queue")
        .update({ status: "pending", attempts: 0, error_message: null })
        .eq("status", "failed");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Failed items requeued");
      qc.invalidateQueries({ queryKey: ["ingestion-queue"] });
    },
  });

  const clearCompleted = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ingestion_queue").delete().eq("status", "completed");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Completed items cleared");
      qc.invalidateQueries({ queryKey: ["ingestion-queue"] });
    },
  });

  if (loading) return null;
  if (!user) return <Navigate to="/trade/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <Helmet>
        <title>Product Ingestion Queue | Maison Affluency Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <header>
        <h1 className="text-2xl font-serif">Product Ingestion Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste supplier product objects or URLs, queue them, then run the ingestion engine.
          Ingested products land hidden and inactive for manual price review.
        </p>
      </header>

      <section className="space-y-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={10}
          placeholder={`[\n  { "source_url": "https://supplier.com/p/123", "sku": "AB-123", "brand_name": "Alinea", "product_name": "Lucca Chair", "category": "Seating" }\n]\n\n— or one URL per line —`}
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap gap-3 items-center">
          <Button onClick={() => enqueue.mutate()} disabled={enqueue.isPending}>
            {enqueue.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Add to queue
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Batch</span>
            <Input
              type="number"
              min={1}
              max={100}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value) || 20)}
              className="w-20 h-9"
            />
          </div>
          <Button variant="secondary" onClick={() => runBatch.mutate()} disabled={runBatch.isPending}>
            {runBatch.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Process batch
          </Button>
          <Button variant="outline" onClick={() => retryFailed.mutate()} disabled={retryFailed.isPending}>
            <RefreshCw className="h-4 w-4 mr-2" /> Retry failed
          </Button>
          <Button variant="ghost" onClick={() => clearCompleted.mutate()} disabled={clearCompleted.isPending}>
            <Trash2 className="h-4 w-4 mr-2" /> Clear completed
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex justify-between text-xs uppercase tracking-wider text-muted-foreground">
          <span>Queue progress {isFetching && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</span>
          <span>{rows.length} shown (latest 200)</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden bg-muted">
          {(["completed", "processing", "pending", "failed"] as const).map((s) =>
            counts[s] ? (
              <div key={s} className={STATUS_COLORS[s]} style={{ width: `${(counts[s] / total) * 100}%` }} />
            ) : null,
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          {(["completed", "processing", "pending", "failed"] as const).map((s) => (
            <span key={s} className="flex items-center gap-2">
              <i className={`inline-block h-2 w-2 ${STATUS_COLORS[s]}`} />
              {s}: <strong>{counts[s]}</strong>
            </span>
          ))}
        </div>
      </section>

      <section className="border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-2 font-medium">Source</th>
              <th className="p-2 font-medium w-28">Status</th>
              <th className="p-2 font-medium w-16">Tries</th>
              <th className="p-2 font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2 break-all max-w-[320px]">{r.source_url}</td>
                <td className="p-2">
                  <Badge variant="outline" className="capitalize">{r.status}</Badge>
                </td>
                <td className="p-2">{r.attempts}</td>
                <td className="p-2 text-red-600 break-words">{r.error_message ?? ""}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">Queue is empty.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
