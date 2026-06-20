import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, Wand2, CheckCircle2, AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Hotspot {
  id: string;
  image_identifier: string;
  product_name: string;
  designer_name: string | null;
  product_image_url: string | null;
  mapped_pick_id: string | null;
}

interface Pick {
  id: string;
  title: string;
  designer: string;
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const tokenize = (s: string) => s.split(" ").filter((t) => t.length > 2);

function suggestPickId(hotspot: Hotspot, picks: (Pick & { _normTitle: string; _normDesigner: string; _titleTokens: string[] })[]): string | null {
  const normName = norm(hotspot.product_name);
  const normDesigner = norm(hotspot.designer_name || "");
  const nameTokens = tokenize(normName);
  let best: { id: string; score: number } | null = null;
  for (const p of picks) {
    const overlap = nameTokens.filter((t) => p._titleTokens.includes(t)).length;
    const shorter = Math.min(nameTokens.length, p._titleTokens.length);
    const nameScore = shorter > 0 ? overlap / shorter : 0;
    const substring =
      p._normTitle.includes(normName) || normName.includes(p._normTitle) ? 0.3 : 0;
    const designerMatch =
      normDesigner &&
      (p._normDesigner.includes(normDesigner) || normDesigner.includes(p._normDesigner));
    let score = nameScore + substring;
    if (designerMatch) score += 0.5;
    if (score < 0.6) continue;
    if (!best || score > best.score) best = { id: p.id, score };
  }
  return best?.id ?? null;
}

export default function TradeAdminHotspotMapping() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [unmappedOnly, setUnmappedOnly] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: hotspots = [], isLoading: hsLoading } = useQuery({
    queryKey: ["admin-hotspots-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_hotspots")
        .select("id, image_identifier, product_name, designer_name, product_image_url, mapped_pick_id")
        .order("designer_name", { ascending: true })
        .order("product_name", { ascending: true });
      if (error) throw error;
      return (data as Hotspot[]) || [];
    },
    enabled: isAdmin,
  });

  const { data: picks = [], isLoading: pkLoading } = useQuery({
    queryKey: ["admin-curator-picks-list"],
    queryFn: async () => {
      const [{ data: rows }, { data: designers }] = await Promise.all([
        supabase.from("designer_curator_picks").select("id, title, designer_id").order("title"),
        supabase.from("designers").select("id, name"),
      ]);
      const dmap = new Map((designers || []).map((d: any) => [d.id, d.name as string]));
      return ((rows as any[]) || []).map((r) => ({
        id: r.id,
        title: r.title as string,
        designer: dmap.get(r.designer_id) || "Unknown",
      })) as Pick[];
    },
    enabled: isAdmin,
  });

  const indexedPicks = useMemo(
    () =>
      picks.map((p) => {
        const nTitle = norm(p.title);
        return {
          ...p,
          _normTitle: nTitle,
          _normDesigner: norm(p.designer),
          _titleTokens: tokenize(nTitle),
        };
      }),
    [picks]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hotspots.filter((h) => {
      if (unmappedOnly && (h.mapped_pick_id || draft[h.id])) return false;
      if (!q) return true;
      return (
        h.product_name.toLowerCase().includes(q) ||
        (h.designer_name || "").toLowerCase().includes(q)
      );
    });
  }, [hotspots, search, unmappedOnly, draft]);

  const dirtyCount = Object.keys(draft).length;

  const applySuggestionsAll = () => {
    const next: Record<string, string> = { ...draft };
    let count = 0;
    for (const h of hotspots) {
      if (h.mapped_pick_id || next[h.id]) continue;
      const suggested = suggestPickId(h, indexedPicks);
      if (suggested) {
        next[h.id] = suggested;
        count++;
      }
    }
    setDraft(next);
    toast({
      title: count > 0 ? `Suggested ${count} mapping${count === 1 ? "" : "s"}` : "No confident suggestions",
      description: count > 0 ? "Review and click Save All to apply." : "Try mapping manually.",
    });
  };

  const applySuggestionToRow = (h: Hotspot) => {
    const suggested = suggestPickId(h, indexedPicks);
    if (!suggested) {
      toast({ title: "No confident match", variant: "destructive" });
      return;
    }
    setDraft((d) => ({ ...d, [h.id]: suggested }));
  };

  const clearDraft = (id: string) =>
    setDraft((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });

  const saveAll = async () => {
    const entries = Object.entries(draft);
    if (entries.length === 0) return;
    setSaving(true);
    try {
      let ok = 0;
      for (const [id, mapped_pick_id] of entries) {
        const { error } = await supabase
          .from("gallery_hotspots")
          .update({ mapped_pick_id: mapped_pick_id || null })
          .eq("id", id);
        if (!error) ok++;
      }
      toast({
        title: `Saved ${ok}/${entries.length} mappings`,
        description: ok < entries.length ? "Some rows failed — check console." : undefined,
      });
      setDraft({});
      qc.invalidateQueries({ queryKey: ["admin-hotspots-all"] });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Hotspot → Catalog Mapping | Maison Affluency</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Link
          to="/trade/admin"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to admin
        </Link>
        <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-serif text-3xl mb-2">Hotspot → Catalog Mapping</h1>
            <p className="text-sm text-muted-foreground">
              Bulk-assign exact catalog picks to gallery hotspots. Overrides the fuzzy matcher
              used by the public "View Product" button.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={applySuggestionsAll}
              className="inline-flex items-center gap-2 text-sm border border-border rounded px-3 py-2 hover:bg-muted transition-colors"
            >
              <Wand2 className="h-4 w-4" /> Auto-suggest all unmapped
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={saving || dirtyCount === 0}
              className="inline-flex items-center gap-2 text-sm bg-primary text-primary-foreground rounded px-4 py-2 hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : `Save All${dirtyCount ? ` (${dirtyCount})` : ""}`}
            </button>
          </div>
        </header>

        <div className="flex items-center gap-4 mb-4">
          <input
            type="search"
            placeholder="Search product or designer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-md text-sm border border-border rounded px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={unmappedOnly}
              onChange={(e) => setUnmappedOnly(e.target.checked)}
            />
            Unmapped only
          </label>
          <span className="text-xs text-muted-foreground ml-auto">
            {hsLoading || pkLoading ? "Loading…" : `${filtered.length} hotspot${filtered.length === 1 ? "" : "s"} shown · ${hotspots.length} total · ${picks.length} catalog picks`}
          </span>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 w-12"></th>
                <th className="px-3 py-2">Hotspot product</th>
                <th className="px-3 py-2">Designer</th>
                <th className="px-3 py-2">Current mapping</th>
                <th className="px-3 py-2 w-[34%]">Assign catalog pick</th>
                <th className="px-3 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                const current = draft[h.id] ?? h.mapped_pick_id ?? "";
                const isDirty = draft[h.id] !== undefined && draft[h.id] !== (h.mapped_pick_id || "");
                const mappedPick = picks.find((p) => p.id === (h.mapped_pick_id || ""));
                return (
                  <tr key={h.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      {h.product_image_url ? (
                        <img
                          src={h.product_image_url}
                          alt=""
                          className="w-10 h-10 object-cover rounded bg-muted"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{h.product_name}</div>
                      <div className="text-[11px] text-muted-foreground">{h.image_identifier}</div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{h.designer_name || "—"}</td>
                    <td className="px-3 py-2">
                      {mappedPick ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {mappedPick.designer} — {mappedPick.title}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <AlertCircle className="h-3.5 w-3.5" /> Fuzzy match
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={current}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [h.id]: e.target.value }))
                        }
                        className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                      >
                        <option value="">— Auto-match by name —</option>
                        {picks.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.designer} — {p.title}
                          </option>
                        ))}
                      </select>
                      {isDirty && (
                        <button
                          type="button"
                          onClick={() => clearDraft(h.id)}
                          className="text-[11px] text-muted-foreground hover:text-foreground mt-1"
                        >
                          Revert
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => applySuggestionToRow(h)}
                        title="Auto-suggest best match"
                        className="inline-flex items-center gap-1 text-xs border border-border rounded px-2 py-1 hover:bg-muted transition-colors"
                      >
                        <Wand2 className="h-3 w-3" /> Suggest
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!hsLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                    No hotspots match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
