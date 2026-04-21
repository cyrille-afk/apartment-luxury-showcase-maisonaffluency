import React, { useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Instagram, ExternalLink, AlertTriangle, CheckCircle, XCircle, Search, ArrowLeft, Pencil, Save, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface DesignerIG {
  id: string;
  slug: string;
  name: string;
  display_name: string | null;
  founder: string | null;
  source: string;
  links: any[];
  dbInstagram: string | null;
  fallbackInstagram: string | null;
  effectiveInstagram: string | null;
  igSource: "db" | "fallback" | "none";
  isParent: boolean;
}

// Hardcoded fallback map (mirrors PublicDesigners.tsx)
const INSTAGRAM_LINKS: Record<string, string> = {
  "okha": "https://www.instagram.com/__okha/",
  "alexander-lamont": "https://instagram.com/alexanderlamont",
  "leo-aerts-alinea": "https://www.instagram.com/alinea_design_objects/",
  "apparatus-studio": "https://instagram.com/apparatusstudio",
  "atelier-fevrier": "https://instagram.com/atelierfevrier",
  "atelier-pendhapa": "https://instagram.com/pendhapa.architects",
  "bina-baitel": "https://www.instagram.com/binabaitel/",
  "bruno-de-maistre": "https://instagram.com/bruno_de_maistre_bdm",
  "emmanuel-levet-stenne": "https://instagram.com/emanuellelevetstenne",
  "entrelacs-creation": "https://instagram.com/entrelacs_lightings",
  "felix-agostini": "https://www.instagram.com/maisoncharlesparis/",
  "robicara": "https://www.instagram.com/robicaradesign/",
  "forest-giaconia": "https://www.instagram.com/forest.giaconia/",
  "garnier-linker": "https://www.instagram.com/garnieretlinker/",
  "hamrei": "https://instagram.com/hamrei",
  "jeremy-maxwell-wintrebert": "https://www.instagram.com/jmw_studio",
  "leo-sentou": "https://www.instagram.com/leosentou",
  "kira": "https://www.instagram.com/madeinkira/",
  "man-of-parts": "https://www.instagram.com/manofparts/",
  "milan-pekar": "https://www.instagram.com/pekarmilan/",
  "nathalie-ziegler": "https://instagram.com/nathaliezieglerpasqua",
  "olivia-cognet": "https://www.instagram.com/olivia_cognet",
  "pierre-bonnefille": "https://www.instagram.com/pierrebonnefille/",
  "reda-amalou": "https://www.instagram.com/redaamaloudesign/",
  "thierry-lemaire": "https://www.instagram.com/thierrylemaire_/",
  "tristan-auer": "https://www.instagram.com/tristanauer/",
  "ecart": "https://instagram.com/ecart.paris",
  "cc-tapis": "https://instagram.com/cc_tapis",
  "veronese": "https://www.instagram.com/veronese_/",
  "theoreme-editions": "https://instagram.com/theoreme_editions",
  "ozone-light": "https://www.instagram.com/ozone_light/",
  "la-chance": "https://www.instagram.com/lachance_paris/",
  "marta-sala-editions": "https://www.instagram.com/martasalaeditions/",
  "mmairo": "https://www.instagram.com/mmairo_design/",
  "pouenat": "https://www.instagram.com/pouenat.official/",
  "de-la-espada": "https://www.instagram.com/delaespada/",
  "delcourt-collection": "https://instagram.com/delcourtcollection",
  "collection-particuliere": "https://www.instagram.com/collection_particuliere/",
  "entrelacs": "https://www.instagram.com/entrelacs_lightings/",
  "haymann-editions": "https://instagram.com/haymanneditions",
  "achille-salvagni-atelier": "https://www.instagram.com/achillesalvagniatelier/",
  "atelier-demichelis": "https://instagram.com/atelier_demichelis",
  "okha": "https://instagram.com/__okha",
  "arredoluce": "https://www.instagram.com/angelolelii/",
  "jean-michel-frank": "",
};

function extractHandle(url: string): string {
  if (!url) return "—";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const path = u.pathname.replace(/\/$/, "").split("/").pop() || "";
    return `@${path}`;
  } catch {
    return url;
  }
}

type FilterMode = "all" | "missing" | "db-only" | "fallback-only" | "parents" | "sub-designers";

const TradeInstagramAudit = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const queryClient = useQueryClient();

  const { data: designers = [], isLoading } = useQuery({
    queryKey: ["ig-audit-designers"],
    enabled: !!isAdmin,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("id, slug, name, display_name, founder, source, links")
        .eq("is_published", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const rows: DesignerIG[] = useMemo(() => {
    return designers.map((d) => {
      const linksArr = Array.isArray(d.links) ? d.links : [];
      const igFromDb = (linksArr.find((l: any) => l.type?.toLowerCase() === "instagram") as any)?.url || null;
      const igFromFallback = INSTAGRAM_LINKS[d.slug] || null;
      const isParent = d.founder === d.name || (!d.founder && !d.display_name);

      return {
        id: d.id,
        slug: d.slug,
        name: d.name,
        display_name: d.display_name,
        founder: d.founder,
        source: d.source,
        links: linksArr,
        dbInstagram: igFromDb,
        fallbackInstagram: igFromFallback,
        effectiveInstagram: igFromDb || igFromFallback || null,
        igSource: igFromDb ? "db" : igFromFallback ? "fallback" : "none",
        isParent,
      } as DesignerIG;
    });
  }, [designers]);

  const handleSaveIg = useCallback(async (row: DesignerIG, newUrl: string) => {
    const trimmed = newUrl.trim();
    // Build updated links array
    const existingLinks = Array.isArray(row.links) ? [...row.links] : [];
    const igIdx = existingLinks.findIndex((l: any) => l.type?.toLowerCase() === "instagram");

    if (trimmed) {
      const entry = { type: "Instagram", url: trimmed };
      if (igIdx >= 0) {
        existingLinks[igIdx] = entry;
      } else {
        existingLinks.push(entry);
      }
    } else {
      // Remove IG entry if URL cleared
      if (igIdx >= 0) existingLinks.splice(igIdx, 1);
    }

    const { error } = await supabase
      .from("designers")
      .update({ links: existingLinks as any })
      .eq("id", row.id);

    if (error) {
      toast.error(`Failed to update: ${error.message}`);
      throw error;
    }

    toast.success(`Updated Instagram for ${row.display_name || row.name}`);
    queryClient.invalidateQueries({ queryKey: ["ig-audit-designers"] });
    queryClient.invalidateQueries({ queryKey: ["ig-missing-count"] });
  }, [queryClient]);

  const filtered = useMemo(() => {
    let result = rows;
    if (filter === "missing") result = result.filter((r) => r.igSource === "none");
    else if (filter === "db-only") result = result.filter((r) => r.igSource === "db");
    else if (filter === "fallback-only") result = result.filter((r) => r.igSource === "fallback");
    else if (filter === "parents") result = result.filter((r) => r.isParent);
    else if (filter === "sub-designers") result = result.filter((r) => !r.isParent && !!r.founder);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.slug.includes(q) ||
          (r.founder || "").toLowerCase().includes(q) ||
          (r.effectiveInstagram || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, filter, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const withIg = rows.filter((r) => r.igSource !== "none").length;
    const dbCount = rows.filter((r) => r.igSource === "db").length;
    const fallbackCount = rows.filter((r) => r.igSource === "fallback").length;
    const missing = total - withIg;
    return { total, withIg, dbCount, fallbackCount, missing };
  }, [rows]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-6 w-6 border-2 border-foreground/20 border-t-foreground rounded-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="font-body text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const filters: { key: FilterMode; label: string; count: number }[] = [
    { key: "all", label: "All", count: rows.length },
    { key: "missing", label: "Missing IG", count: stats.missing },
    { key: "db-only", label: "DB Links", count: stats.dbCount },
    { key: "fallback-only", label: "Fallback Only", count: stats.fallbackCount },
    { key: "parents", label: "Parent Brands", count: rows.filter((r) => r.isParent).length },
    { key: "sub-designers", label: "Sub-Designers", count: rows.filter((r) => !r.isParent && !!r.founder).length },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/trade/designers/admin" className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="font-display text-xl md:text-2xl text-foreground">Instagram Audit</h1>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            Visual map of all designer Instagram accounts — click <Pencil className="inline h-3 w-3 mx-0.5" /> to edit
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Designers" value={stats.total} />
        <StatCard label="With Instagram" value={stats.withIg} variant="success" />
        <StatCard label="From Database" value={stats.dbCount} variant="info" />
        <StatCard label="Fallback Only" value={stats.fallbackCount} variant="warning" />
        <StatCard label="Missing" value={stats.missing} variant="error" />
      </div>

      {/* Coverage bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          <span>Instagram Coverage</span>
          <span>{Math.round((stats.withIg / stats.total) * 100)}%</span>
        </div>
        <div className="h-2 bg-muted/30 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500/80 h-full transition-all"
            style={{ width: `${(stats.dbCount / stats.total) * 100}%` }}
            title={`DB: ${stats.dbCount}`}
          />
          <div
            className="bg-amber-400/80 h-full transition-all"
            style={{ width: `${(stats.fallbackCount / stats.total) * 100}%` }}
            title={`Fallback: ${stats.fallbackCount}`}
          />
        </div>
        <div className="flex gap-4 font-body text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500/80" /> Database</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400/80" /> Fallback</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted/50" /> Missing</span>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`font-body text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-full border transition-all ${
                filter === f.key
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search designer or handle…"
            className="pl-9 h-8 text-xs font-body"
          />
        </div>
      </div>

      {/* Visual grid map */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {filtered.map((r) => (
          <DesignerIGCard key={r.slug} row={r} onSave={handleSaveIg} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="font-body text-sm text-muted-foreground">No designers match your filters.</p>
        </div>
      )}
    </div>
  );
};

function StatCard({ label, value, variant }: { label: string; value: number; variant?: string }) {
  const colors: Record<string, string> = {
    success: "border-emerald-500/30 bg-emerald-500/5",
    info: "border-sky-500/30 bg-sky-500/5",
    warning: "border-amber-400/30 bg-amber-400/5",
    error: "border-red-500/30 bg-red-500/5",
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[variant || ""] || "border-border bg-muted/5"}`}>
      <p className="font-body text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="font-display text-2xl text-foreground mt-1">{value}</p>
    </div>
  );
}

function DesignerIGCard({ row, onSave }: { row: DesignerIG; onSave: (row: DesignerIG, url: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editValue, setEditValue] = useState("");

  const handle = row.effectiveInstagram ? extractHandle(row.effectiveInstagram) : null;

  const borderColor =
    row.igSource === "db"
      ? "border-emerald-500/40"
      : row.igSource === "fallback"
      ? "border-amber-400/40"
      : "border-red-500/30";

  const StatusIcon =
    row.igSource === "db"
      ? CheckCircle
      : row.igSource === "fallback"
      ? AlertTriangle
      : XCircle;

  const statusColor =
    row.igSource === "db"
      ? "text-emerald-500"
      : row.igSource === "fallback"
      ? "text-amber-400"
      : "text-red-400";

  const displayName = row.display_name || row.name;

  const startEditing = () => {
    setEditValue(row.dbInstagram || row.fallbackInstagram || "");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditValue("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(row, editValue);
      setEditing(false);
    } catch {
      // error already toasted
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-lg border ${borderColor} bg-card p-3 space-y-2 hover:shadow-md transition-shadow`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className="font-body text-[11px] text-foreground font-medium leading-tight truncate" title={displayName}>
            {displayName}
          </p>
          {row.founder && row.founder !== row.name && (
            <p className="font-body text-[9px] text-muted-foreground/60 uppercase tracking-[0.08em] truncate mt-0.5">
              {row.founder}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {!editing && (
            <button
              onClick={startEditing}
              className="p-0.5 rounded hover:bg-muted/50 transition-colors"
              aria-label={`Edit Instagram for ${displayName}`}
              title="Edit Instagram URL"
            >
              <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
          <StatusIcon className={`h-3 w-3 ${statusColor}`} />
        </div>
      </div>

      {/* Edit mode */}
      {editing ? (
        <div className="space-y-1.5">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="https://instagram.com/handle"
            className="h-7 text-[10px] font-body px-2"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") cancelEditing();
            }}
          />
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 transition-colors font-body text-[9px] uppercase tracking-[0.1em] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Save className="h-2.5 w-2.5" />}
              Save
            </button>
            <button
              onClick={cancelEditing}
              disabled={saving}
              className="flex items-center gap-1 px-2 py-1 rounded bg-muted/30 text-muted-foreground hover:bg-muted/50 transition-colors font-body text-[9px] uppercase tracking-[0.1em] disabled:opacity-50"
            >
              <X className="h-2.5 w-2.5" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* IG handle display */
        <div className="flex items-center gap-1.5">
          <Instagram className="h-3 w-3 text-muted-foreground shrink-0" />
          {handle ? (
            <a
              href={row.effectiveInstagram!}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body text-[10px] text-foreground hover:text-primary truncate flex items-center gap-1"
            >
              {handle}
              <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-50" />
            </a>
          ) : (
            <button
              onClick={startEditing}
              className="font-body text-[10px] text-red-400 italic hover:text-red-300 transition-colors cursor-pointer"
            >
              + Add link
            </button>
          )}
        </div>
      )}

      {/* Source badge */}
      <div className="flex items-center gap-1.5">
        <span
          className={`font-body text-[8px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full ${
            row.igSource === "db"
              ? "bg-emerald-500/10 text-emerald-600"
              : row.igSource === "fallback"
              ? "bg-amber-400/10 text-amber-600"
              : "bg-red-500/10 text-red-500"
          }`}
        >
          {row.igSource === "db" ? "Database" : row.igSource === "fallback" ? "Fallback" : "Missing"}
        </span>
        {row.isParent && (
          <span className="font-body text-[8px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
            Parent
          </span>
        )}
      </div>
    </div>
  );
}

export default TradeInstagramAudit;
