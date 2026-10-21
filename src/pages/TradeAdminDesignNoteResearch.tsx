import { useEffect, useRef, useState } from "react";
import { Navigate } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Source = { url: string; evidence: string };
type Draft = {
  id: string; pick_id: string; product_title: string; designer_name: string;
  form: string | null; function: string | null; texture: string | null; colour: string | null;
  sources: Source[]; review_status: string; reviewer_notes: string | null; updated_at: string;
};
const STATUSES = ["draft", "needs_review", "approved", "rejected", "published"];
const FIELDS = ["form", "function", "texture", "colour"] as const;
const db = supabase as any;

function DraftEditor({ draft, onSaved }: { draft: Draft; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const [state, setState] = useState<"saved" | "saving" | "error">("saved");
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) return;
    setState("saving");
    const t = setTimeout(async () => {
      const { error } = await db.from("design_note_research_drafts").update({
        form: d.form, function: d.function, texture: d.texture, colour: d.colour,
        sources: d.sources, review_status: d.review_status, reviewer_notes: d.reviewer_notes,
      }).eq("id", d.id);
      setState(error ? "error" : "saved");
      if (!error) { dirty.current = false; onSaved(); }
    }, 800);
    return () => clearTimeout(t);
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<Draft>) => { dirty.current = true; setD((x) => ({ ...x, ...patch })); };

  const publish = async () => {
    const fields = Object.fromEntries(FIELDS.map((f) => [f, d[f]?.trim() || null]));
    if (!Object.values(fields).some(Boolean) || !d.sources.some((s) => /^https?:\/\//.test(s.url) && s.evidence.trim())) {
      alert("Needs at least one note and one source with URL and evidence."); return;
    }
    const { data, error } = await db.from("product_design_notes")
      .upsert({ pick_id: d.pick_id, ...fields, sources: d.sources }, { onConflict: "pick_id", ignoreDuplicates: true }).select();
    if (error) { alert(error.message); return; }
    if (!data?.length) { alert("Notes already exist for this product — not overwritten."); return; }
    set({ review_status: "published" });
  };

  return (
    <div className="border border-border p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between gap-2">
        <div><p className="font-medium">{d.product_title}</p><p className="text-xs text-muted-foreground">{d.designer_name}</p></div>
        <div className="flex items-center gap-2 text-xs">
          <span className={state === "error" ? "text-destructive" : "text-muted-foreground"}>
            {state === "saving" ? "Saving…" : state === "error" ? "Save failed — retrying on next edit" : "Saved"}
          </span>
          <select className="border border-input bg-background px-2 py-1" value={d.review_status}
            onChange={(e) => set({ review_status: e.target.value })}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <Button size="sm" disabled={d.review_status !== "approved"} onClick={publish}>Publish</Button>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        {FIELDS.map((f) => (
          <Textarea key={f} placeholder={f[0].toUpperCase() + f.slice(1)} value={d[f] ?? ""}
            onChange={(e) => set({ [f]: e.target.value } as Partial<Draft>)} />
        ))}
      </div>
      <div className="space-y-2">
        {d.sources.map((s, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="https://maker source" value={s.url}
              onChange={(e) => set({ sources: d.sources.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} />
            <Input placeholder="Quoted evidence" value={s.evidence}
              onChange={(e) => set({ sources: d.sources.map((x, j) => j === i ? { ...x, evidence: e.target.value } : x) })} />
            <Button variant="ghost" size="sm" onClick={() => set({ sources: d.sources.filter((_, j) => j !== i) })}>✕</Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => set({ sources: [...d.sources, { url: "", evidence: "" }] })}>Add source</Button>
      </div>
      <Textarea placeholder="Reviewer notes / blockers" value={d.reviewer_notes ?? ""}
        onChange={(e) => set({ reviewer_notes: e.target.value })} />
    </div>
  );
}

export default function TradeAdminDesignNoteResearch() {
  const { user, isAdmin, rolesLoaded } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const enabled = !!user && isAdmin;

  const drafts = useQuery({
    queryKey: ["research-drafts"], enabled,
    queryFn: async () => {
      const { data, error } = await db.from("design_note_research_drafts").select("*").order("updated_at", { ascending: false });
      if (error) throw error; return data as Draft[];
    },
  });
  const picks = useQuery({
    queryKey: ["research-pick-search", search], enabled: enabled && search.trim().length > 2,
    queryFn: async () => {
      const { data } = await db.from("designer_curator_picks").select("id, title, designers(name)").ilike("title", `%${search.trim()}%`).limit(10);
      return (data ?? []) as { id: string; title: string; designers: { name: string } | null }[];
    },
  });

  if (rolesLoaded && (!user || !isAdmin)) return <Navigate to="/trade" replace />;

  const add = async (p: { id: string; title: string; designers: { name: string } | null }) => {
    const { error } = await db.from("design_note_research_drafts").upsert(
      { pick_id: p.id, product_title: p.title, designer_name: p.designers?.name ?? "" },
      { onConflict: "pick_id", ignoreDuplicates: true });
    if (error) alert(error.message);
    setSearch(""); qc.invalidateQueries({ queryKey: ["research-drafts"] });
  };
  const list = (drafts.data ?? []).filter((d) => status === "all" || d.review_status === status);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, (drafts.data ?? []).filter((d) => d.review_status === s).length]));

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl">Design Note Research</h1>
        <p className="text-sm text-muted-foreground"><a href="/trade/admin/design-note-coverage" className="underline">Coverage dashboard</a> · Drafts autosave. Publishing never overwrites existing product notes.</p>
      </div>
      <div className="relative">
        <Input placeholder="Add product to research (search title)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {!!picks.data?.length && (
          <div className="absolute z-10 w-full bg-popover border border-border">
            {picks.data.map((p) => (
              <button key={p.id} className="block w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => add(p)}>
                {p.title} <span className="text-muted-foreground">— {p.designers?.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {["all", ...STATUSES].map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
            {s} {s === "all" ? drafts.data?.length ?? 0 : counts[s]}
          </Button>
        ))}
      </div>
      {drafts.isLoading ? <p className="text-sm">Loading…</p> : list.map((d) => (
        <DraftEditor key={d.id} draft={{ ...d, sources: Array.isArray(d.sources) ? d.sources : [] }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["research-drafts"] })} />
      ))}
    </div>
  );
}
