import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Database, Square } from "lucide-react";

type BackfillResult = {
  id: string;
  title: string;
  designer: string;
  ok: boolean;
  error?: string;
};

type BackfillResponse = {
  processed?: number;
  succeeded?: number;
  failed?: number;
  results?: BackfillResult[];
  total?: number;
  embedded?: number;
  missing?: number;
  error?: string;
};

export default function CanonicalRagMigration() {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { data: stats, refetch } = useQuery({
    queryKey: ["rag-backfill-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("backfill-embeddings", {
        body: { action: "status" },
      });
      if (error) throw error;
      return data as BackfillResponse;
    },
  });

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [log]);

  const append = (line: string) => setLog((l) => [...l.slice(-400), line]);

  const runLoop = async () => {
    setRunning(true);
    stopRef.current = false;
    append(`[Start] Canonical RAG migration — batches of 10`);
    try {
      for (let batch = 1; ; batch++) {
        if (stopRef.current) {
          append("[Halted] Stopped by operator.");
          break;
        }
        const { data, error } = await supabase.functions.invoke("backfill-embeddings", {
          body: { action: "backfill" },
        });
        if (error) throw error;
        const res = data as BackfillResponse;
        if (res.error) throw new Error(res.error);

        (res.results ?? []).forEach((r) => {
          append(
            r.ok
              ? `[Success] Embedded: ${r.designer} - ${r.title}`
              : `[Failed] ${r.designer} - ${r.title} — ${r.error ?? "unknown error"}`,
          );
        });

        await refetch();

        if (!res.processed) {
          append("[Complete] No unprocessed products remain.");
          break;
        }
        append(`[Batch ${batch}] ${res.succeeded ?? 0} ok · ${res.failed ?? 0} failed · ${res.missing ?? 0} remaining`);
        if ((res.missing ?? 0) <= 0) {
          append("[Complete] Catalog fully embedded.");
          break;
        }
      }
    } catch (e) {
      append(`[Error] ${(e as Error).message}`);
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
      refetch();
    }
  };

  const total = stats?.total ?? 0;
  const missing = stats?.missing ?? 0;

  return (
    <section className="border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4">
        <div>
          <h2 className="font-serif text-lg">Canonical RAG Migration</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Structures and embeds catalog products into the canonical vector store.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {running && (
            <Button variant="outline" onClick={() => (stopRef.current = true)}>
              <Square className="h-4 w-4 mr-2" /> Halt
            </Button>
          )}
          <Button
            onClick={runLoop}
            disabled={running}
            className="bg-neutral-900 text-neutral-50 hover:bg-neutral-800 tracking-wide uppercase text-xs px-6 h-11 rounded-none"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Database className="h-4 w-4 mr-2" />
            )}
            Execute Global Backfill Loop
          </Button>
        </div>
      </header>

      <div className="px-5 py-4 space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Unprocessed Products</div>
            <div className="text-3xl font-serif tabular-nums">
              {missing} <span className="text-base text-muted-foreground">/ Total Catalog: {total}</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Embedded: {stats?.embedded ?? 0}</div>
        </div>

        <div className="h-2 w-full bg-muted overflow-hidden">
          <div
            className="h-full bg-emerald-600 transition-all"
            style={{ width: total ? `${((total - missing) / total) * 100}%` : "0%" }}
          />
        </div>

        <div className="bg-neutral-950 text-neutral-200 font-mono text-[11px] leading-relaxed p-4 h-64 overflow-y-auto">
          {log.length === 0 ? (
            <span className="text-neutral-500">Terminal idle. Execute the backfill loop to stream results.</span>
          ) : (
            log.map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith("[Success]")
                    ? "text-emerald-400"
                    : line.startsWith("[Failed]") || line.startsWith("[Error]")
                      ? "text-red-400"
                      : "text-neutral-400"
                }
              >
                {line}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </section>
  );
}
