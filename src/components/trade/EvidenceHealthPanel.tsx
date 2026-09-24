import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Run = {
  id: string;
  studio_name: string | null;
  outcome: string;
  images_found: number;
  images_cached: number;
  images_reused: number;
  skipped: { url: string; reason: string }[];
  rate_limited_count: number;
  reader_failures: string[];
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

type Dna = { trade_account_id: string; status: string; analyzed_at: string | null; updated_at?: string | null; image_urls: string[] | null };

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <p className="font-body text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
    <p className="mt-1 font-serif text-3xl text-foreground">{value}</p>
  </div>
);

export const EvidenceHealthPanel = () => {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["evidence-health"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const [runs, dna] = await Promise.all([
        supabase.from("studio_evidence_runs").select("*").gte("started_at", since).order("started_at", { ascending: false }).limit(200),
        supabase.from("studio_aesthetic_dna").select("trade_account_id, status, analyzed_at, image_urls, trade_accounts(studio_name)"),
      ]);
      return { runs: (runs.data ?? []) as unknown as Run[], dna: (dna.data ?? []) as unknown as (Dna & { trade_accounts: { studio_name: string | null } | null })[] };
    },
  });

  const runs = data?.runs ?? [];
  const done = runs.filter((r) => r.outcome !== "running");
  const ok = done.filter((r) => r.outcome === "complete").length;
  const rate = done.length ? `${Math.round((ok / done.length) * 100)}%` : "—";
  const skippedTotal = runs.reduce((n, r) => n + (r.skipped?.length ?? 0), 0);
  const rl = runs.reduce((n, r) => n + r.rate_limited_count, 0);
  const failures = runs.filter((r) => r.rate_limited_count > 0 || (r.reader_failures?.length ?? 0) > 0 || r.outcome === "failed").slice(0, 10);
  const skippedRows = runs.flatMap((r) => (r.skipped ?? []).map((s) => ({ ...s, studio: r.studio_name, at: r.started_at }))).slice(0, 15);

  return (
    <section className="border border-border bg-background px-6 py-5">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="font-body text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground">Evidence Health · last 30 days</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      <div className="mt-4 grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat label="Scraper success" value={done.length ? `${rate} (${ok}/${done.length})` : "—"} />
        <Stat label="Assets skipped" value={String(skippedTotal)} />
        <Stat label="429 rate limits" value={String(rl)} />
        <Stat label="Reader failures" value={String(runs.filter((r) => (r.reader_failures?.length ?? 0) > 0).length)} />
      </div>

      {open && (
        <div className="mt-6 space-y-6 text-xs">
          <div>
            <h4 className="mb-2 font-body text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Cache timestamps</h4>
            {(data?.dna ?? []).length === 0 ? <p className="text-muted-foreground">No profiles.</p> : (
              <table className="w-full"><tbody>
                {(data?.dna ?? []).map((d) => (
                  <tr key={d.trade_account_id} className="border-t border-border">
                    <td className="py-1.5 pr-3">{d.trade_accounts?.studio_name ?? "—"}</td>
                    <td className="pr-3 text-muted-foreground">{d.status}</td>
                    <td className="pr-3">{(d.image_urls ?? []).length}/6 cached</td>
                    <td className="text-muted-foreground">{fmt(d.analyzed_at)}</td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </div>
          <div>
            <h4 className="mb-2 font-body text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Recent 429 / reader failures</h4>
            {failures.length === 0 ? <p className="text-muted-foreground">None recorded.</p> : failures.map((r) => (
              <div key={r.id} className="border-t border-border py-1.5">
                <span className="font-medium">{r.studio_name ?? "—"}</span> <span className="text-muted-foreground">· {fmt(r.started_at)} · {r.outcome}{r.rate_limited_count ? ` · ${r.rate_limited_count}× 429` : ""}</span>
                {(r.reader_failures ?? []).map((f) => <p key={f} className="text-muted-foreground">{f}</p>)}
                {r.error && <p className="text-destructive">{r.error}</p>}
              </div>
            ))}
          </div>
          <div>
            <h4 className="mb-2 font-body text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Skipped assets</h4>
            {skippedRows.length === 0 ? <p className="text-muted-foreground">None recorded.</p> : skippedRows.map((s, i) => (
              <div key={i} className="flex min-w-0 gap-3 border-t border-border py-1.5">
                <span className="shrink-0 font-medium">{s.reason}</span>
                <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-muted-foreground underline-offset-2 hover:underline">{s.url}</a>
                <span className="ml-auto shrink-0 text-muted-foreground">{s.studio}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default EvidenceHealthPanel;
