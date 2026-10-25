import { useQuery } from "@tanstack/react-query";
import { Navigate } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AuditRecord = {
  id: string; title: string; brand_name: string; file_url: string; storage_path: string | null;
  legacy_public_url: string | null; private_file_exists: boolean; cover_image_url: string | null;
};
type Audit = {
  records: AuditRecord[];
  public_files: { bucket: string; name: string; size: number | null }[];
  private_bucket_public: boolean;
  checked_at: string;
};
type Reach = "reachable" | "removed" | "unknown";

async function probe(url: string): Promise<Reach> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return res.ok ? "reachable" : "removed";
  } catch {
    return "unknown";
  }
}

type Issue = { severity: "high" | "medium"; label: string; doc?: string; detail: string; action: string };

function buildIssues(a: Audit, reach: Record<string, Reach>): Issue[] {
  const issues: Issue[] = [];
  if (a.private_bucket_public) issues.push({ severity: "high", label: "Private storage is public", detail: "The price list storage area is set to public.", action: "Switch it back to private." });
  for (const r of a.records) {
    const doc = `${r.brand_name} — ${r.title}`;
    if (!r.storage_path) issues.push({ severity: "high", label: "Not in private storage", doc, detail: r.file_url, action: "Re-save this price list in Documents admin to move it." });
    else if (!r.private_file_exists) issues.push({ severity: "high", label: "Private file missing", doc, detail: r.storage_path, action: "Upload the file again in Documents admin." });
    if (/^https?:/i.test(r.file_url)) issues.push({ severity: "high", label: "Record still points to a public link", doc, detail: r.file_url, action: "Re-save this price list in Documents admin." });
    if (r.legacy_public_url) {
      const s = reach[r.legacy_public_url];
      if (s !== "removed") issues.push({
        severity: "high", label: s === "reachable" ? "Old outside link still works" : "Old outside link could not be checked", doc,
        detail: r.legacy_public_url, action: "Delete this file in your Cloudinary account, then re-run the audit.",
      });
    }
  }
  for (const f of a.public_files) issues.push({ severity: "high", label: "Price-list-like file in public storage", detail: `${f.bucket}/${f.name}`, action: "Check it; delete it if it is a price list." });
  const covers = a.records.filter((r) => r.cover_image_url).length;
  if (covers) issues.push({ severity: "medium", label: `${covers} cover pictures are public`, detail: "First-page pictures used on Resources cards.", action: "Usually fine; replace any cover that shows prices." });
  return issues;
}

export default function TradeAdminPriceListAudit() {
  const { user, isAdmin, loading, rolesLoaded } = useAuth();
  const q = useQuery({
    queryKey: ["admin-price-list-audit"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_price_list_audit" as never);
      if (error) throw error;
      const audit = data as unknown as Audit;
      const urls = audit.records.map((r) => r.legacy_public_url).filter(Boolean) as string[];
      const reach: Record<string, Reach> = {};
      await Promise.all(urls.map(async (u) => { reach[u] = await probe(u); }));
      return { audit, reach };
    },
  });

  if (loading || (user && !rolesLoaded && !isAdmin)) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const issues = q.data ? buildIssues(q.data.audit, q.data.reach) : [];
  const high = issues.filter((i) => i.severity === "high").length;
  const total = q.data?.audit.records.length ?? 0;
  const secured = q.data ? q.data.audit.records.filter((r) => r.storage_path && r.private_file_exists && !/^https?:/i.test(r.file_url)).length : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-foreground">Price List Security Audit</h1>
          <p className="font-body text-sm text-muted-foreground">Checks every price list record, private storage, public storage and old outside links.</p>
        </div>
        <button onClick={() => q.refetch()} disabled={q.isFetching} className="rounded-md border border-border px-4 py-2 font-body text-xs uppercase tracking-[0.12em] text-foreground hover:bg-muted disabled:opacity-50">
          {q.isFetching ? "Checking…" : "Run audit again"}
        </button>
      </div>

      {q.isLoading ? (
        <div className="h-32 animate-pulse rounded-lg bg-muted/40" />
      ) : q.error ? (
        <p className="font-body text-sm text-destructive">The audit could not run. Try again.</p>
      ) : q.data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Price lists secured" value={`${secured} / ${total}`} />
            <Stat label="Needs securing" value={String(high)} tone={high ? "bad" : "good"} />
            <Stat label="Last checked" value={new Date(q.data.audit.checked_at).toLocaleString()} />
          </div>
          {issues.length === 0 ? (
            <p className="rounded-lg border border-border p-6 font-body text-sm text-foreground">Everything is secured. No public price list links or files were found.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {issues.map((i, idx) => (
                <li key={idx} className="space-y-1 p-4">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 font-body text-[9px] uppercase tracking-wider",
                      i.severity === "high" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                      {i.severity === "high" ? "Needs securing" : "Review"}
                    </span>
                    <span className="font-body text-sm text-foreground">{i.label}</span>
                  </div>
                  {i.doc && <p className="font-display text-sm text-foreground">{i.doc}</p>}
                  <p className="break-all font-mono text-[11px] text-muted-foreground">{i.detail}</p>
                  <p className="font-body text-xs text-foreground/80">{i.action}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-xl", tone === "bad" ? "text-destructive" : "text-foreground")}>{value}</p>
    </div>
  );
}
