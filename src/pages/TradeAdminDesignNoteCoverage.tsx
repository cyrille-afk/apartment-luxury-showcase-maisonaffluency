import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const db = supabase as any;
const FIELDS = ["form", "function", "texture", "colour"] as const;
type Src = { url?: string; evidence?: string };
const normSources = (v: any): Src[] => {
  const toUrl = (u: string) => (/^https?:\/\//.test(u) ? u : `https://${u.replace(/^\/+/, "")}`);
  if (typeof v === "string" && v.trim().startsWith("[")) { try { return normSources(JSON.parse(v)); } catch { /* fall through */ } }
  if (typeof v === "string") return v.split(/[;,\s]+/).filter((x) => x.includes(".")).map((u) => ({ url: toUrl(u) }));
  if (Array.isArray(v)) return v.flatMap((x) => typeof x === "string" ? normSources(x) : x?.url ? [{ url: toUrl(x.url), evidence: x.evidence ?? x.title }] : []);
  return [];
};
type Row = {
  pick_id: string; title: string; designer: string; fields: Record<string, boolean>;
  sources: Src[]; status: string;
};

export const isHomePageUrl = (u?: string) => {
  if (!u) return false;
  try { const x = new URL(u); return (x.pathname === "/" || x.pathname === "") && !x.search; } catch { return true; }
};

function SourceCell({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const save = async (i: number) => {
    const url = val.trim();
    if (!/^https?:\/\//.test(url) || isHomePageUrl(url)) { setErr("Enter an exact product page URL"); return; }
    const next = row.sources.map((s, j) => (j === i ? { ...s, url } : s));
    const table = row.status === "published" ? "product_design_notes" : "design_note_research_drafts";
    const { error } = await db.from(table).update({ sources: table === "product_design_notes" ? JSON.stringify(next) : next }).eq("pick_id", row.pick_id);
    if (error) { setErr(error.message); return; }
    setEditing(null); setErr(""); onSaved();
  };
  return (
    <div className="space-y-1">
      {row.sources.filter((s) => s.url).map((s, i) => editing === i ? (
        <div key={i} className="flex gap-1">
          <Input autoFocus className="h-7 text-xs min-w-[260px]" value={val} onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save(i)} placeholder="https://maker.com/product/…" />
          <Button size="sm" className="h-7" onClick={() => save(i)}>Save</Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => { setEditing(null); setErr(""); }}>✕</Button>
        </div>
      ) : (
        <div key={i} className="flex items-center gap-2">
          <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.evidence}
            className="underline truncate max-w-[220px]">{s.url!.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>
          {isHomePageUrl(s.url) && (
            <>
              <span className="text-[10px] uppercase tracking-wide border border-destructive text-destructive px-1">Home page</span>
              <button className="text-xs underline text-muted-foreground" onClick={() => { setEditing(i); setVal(s.url!); }}>Replace</button>
            </>
          )}
        </div>
      ))}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

export default function TradeAdminDesignNoteCoverage() {
  const { user, isAdmin, rolesLoaded } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "complete" | "partial" | "none" | "home" | `missing-${(typeof FIELDS)[number]}`>("all");
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
      if (filter === "home" && !r.sources.some((x) => isHomePageUrl(x.url))) return false;
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
        {(["all", "complete", "partial", "none", "home"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "home" ? `home-page citations (${all.filter((r) => r.sources.some((x) => isHomePageUrl(x.url))).length})` : f}
          </Button>
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
                  <td className="p-2"><SourceCell row={r} onSaved={() => qc.invalidateQueries({ queryKey: ["design-note-coverage"] })} /></td>
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
