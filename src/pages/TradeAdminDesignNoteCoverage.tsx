import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const db = supabase as any;
const FIELDS = ["form", "function", "texture", "colour"] as const;
type Src = { url?: string; evidence?: string };
const normSources = (v: any): Src[] => {
  const toUrl = (u: string) => (/^https?:\/\//.test(u) ? u : `https://${u.replace(/^\/+/, "")}`);
  if (typeof v === "string") return v.split(/[;,\s]+/).filter((x) => x.includes(".")).map((u) => ({ url: toUrl(u) }));
  if (Array.isArray(v)) return v.flatMap((x) => typeof x === "string" ? normSources(x) : x?.url ? [{ url: toUrl(x.url), evidence: x.evidence ?? x.title }] : []);
  return [];
};
type Row = {
  pick_id: string; title: string; designer: string; fields: Record<string, boolean>;
  sources: Src[]; status: string;
};

export default function TradeAdminDesignNoteCoverage() {
  const { user, isAdmin, rolesLoaded } = useAuth();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "complete" | "partial" | "none">("all");
  const enabled = !!user && isAdmin;

  const { data, isLoading } = useQuery({
    queryKey: ["design-note-coverage"], enabled,
    queryFn: async () => {
      const [notes, drafts, picks] = await Promise.all([
        db.from("product_design_notes").select("pick_id, form, function, texture, colour, sources"),
        db.from("design_note_research_drafts").select("pick_id, review_status, sources"),
        db.from("designer_curator_picks").select("id, title, is_hidden, designers(name)").limit(5000),
      ]);
      if (notes.error) throw notes.error;
      if (picks.error) throw picks.error;
      const noteMap = new Map<string, any>((notes.data ?? []).map((n: any) => [n.pick_id, n]));
      const draftMap = new Map<string, any>((drafts.data ?? []).map((d: any) => [d.pick_id, d]));
      return (picks.data ?? []).filter((p: any) => !p.is_hidden).map((p: any): Row => {
        const n = noteMap.get(p.id); const d = draftMap.get(p.id);
        return {
          pick_id: p.id, title: p.title, designer: p.designers?.name ?? "",
          fields: Object.fromEntries(FIELDS.map((f) => [f, !!n?.[f]?.trim?.()])),
          sources: normSources(n?.sources ?? d?.sources),
          status: n ? "published" : d?.review_status ?? "not started",
        };
      });
    },
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      const c = FIELDS.filter((f) => r.fields[f]).length;
      if (filter === "complete" && c !== 4) return false;
      if (filter === "partial" && (c === 0 || c === 4)) return false;
      if (filter === "none" && c !== 0) return false;
      return !term || `${r.title} ${r.designer}`.toLowerCase().includes(term);
    }).sort((a, b) => FIELDS.filter((f) => b.fields[f]).length - FIELDS.filter((f) => a.fields[f]).length || a.title.localeCompare(b.title));
  }, [data, q, filter]);

  if (rolesLoaded && (!user || !isAdmin)) return <Navigate to="/trade" replace />;

  const all = data ?? [];
  const count = (n: number) => all.filter((r) => FIELDS.filter((f) => r.fields[f]).length === n).length;
  const complete = count(4), none = count(0);

  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">Design Note Coverage</h1>
          <p className="text-sm text-muted-foreground">Visible products with verified Form, Function, Texture and Colour notes.</p>
        </div>
        <Link to="/trade/admin/design-note-research" className="text-sm underline">Open research workspace</Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Products", all.length], ["All four notes", complete], ["Partial", all.length - complete - none], ["No notes", none]].map(([l, v]) => (
          <div key={l as string} className="border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{l}</p>
            <p className="text-2xl font-display">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Input className="max-w-xs" placeholder="Search product or designer" value={q} onChange={(e) => setQ(e.target.value)} />
        {(["all", "complete", "partial", "none"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f}</Button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} shown</span>
      </div>
      {isLoading ? <p className="text-sm">Loading…</p> : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2">Product</th><th className="p-2">Designer</th>
                {FIELDS.map((f) => <th key={f} className="p-2 capitalize text-center">{f}</th>)}
                <th className="p-2">Sources</th><th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pick_id} className="border-t border-border align-top">
                  <td className="p-2 font-medium">{r.title}</td>
                  <td className="p-2 text-muted-foreground">{r.designer}</td>
                  {FIELDS.map((f) => (
                    <td key={f} className="p-2 text-center">{r.fields[f] ? <span className="text-primary">✓</span> : <span className="text-muted-foreground">—</span>}</td>
                  ))}
                  <td className="p-2">
                    {r.sources.filter((s) => s.url).map((s, i) => (
                      <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" title={s.evidence}
                        className="block underline truncate max-w-[260px]">{s.url!.replace(/^https?:\/\//, "").split("/")[0]}</a>
                    ))}
                  </td>
                  <td className="p-2 text-xs">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
