/**
 * Studio Memory Card
 * ------------------
 * Inspect and override what the trade concierge has auto-learned about the
 * signed-in user (standing deadline, budget, currency, lead-time ceiling,
 * studio style notes + preferred materials/categories/designers). Backed by
 * `trade_user_memory` (one row per user, RLS scoped to auth.uid()).
 *
 * The concierge auto-fills this row from each turn's extracted brief — this
 * UI is the manual override / inspection surface. Users can edit any field
 * and save, or wipe a single field by clearing it.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Brain, Save, Trash2 } from "lucide-react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";

type MemoryRow = {
  default_deadline: string | null;
  default_budget_cents: number | null;
  default_currency: string | null;
  preferred_lead_weeks_max: number | null;
  studio_style_notes: string | null;
  style_tags: string[] | null;
  preferred_materials: string[] | null;
  preferred_categories: string[] | null;
  preferred_designers: string[] | null;
  last_brief_summary: string | null;
  updated_at: string | null;
};

const EMPTY: MemoryRow = {
  default_deadline: null,
  default_budget_cents: null,
  default_currency: null,
  preferred_lead_weeks_max: null,
  studio_style_notes: null,
  style_tags: [],
  preferred_materials: [],
  preferred_categories: [],
  preferred_designers: [],
  last_brief_summary: null,
  updated_at: null,
};

const arrToCsv = (a: string[] | null | undefined) => (a || []).join(", ");
const csvToArr = (s: string) =>
  s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 24);

export default function StudioMemoryCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<MemoryRow>(EMPTY);

  // Local string-buffer fields so users can clear inputs without re-typing.
  const [budgetStr, setBudgetStr] = useState("");
  const [leadStr, setLeadStr] = useState("");
  const [stylesStr, setStylesStr] = useState("");
  const [matsStr, setMatsStr] = useState("");
  const [catsStr, setCatsStr] = useState("");
  const [desStr, setDesStr] = useState("");

  const hydrate = (m: MemoryRow) => {
    setRow(m);
    setBudgetStr(m.default_budget_cents ? String(Math.round(m.default_budget_cents / 100)) : "");
    setLeadStr(m.preferred_lead_weeks_max ? String(m.preferred_lead_weeks_max) : "");
    setStylesStr(arrToCsv(m.style_tags));
    setMatsStr(arrToCsv(m.preferred_materials));
    setCatsStr(arrToCsv(m.preferred_categories));
    setDesStr(arrToCsv(m.preferred_designers));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("trade_user_memory")
        .select("default_deadline, default_budget_cents, default_currency, preferred_lead_weeks_max, studio_style_notes, style_tags, preferred_materials, preferred_categories, preferred_designers, last_brief_summary, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      hydrate((data as MemoryRow) || EMPTY);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const hasAny = useMemo(() => {
    return Boolean(
      row.default_deadline || row.default_budget_cents || row.preferred_lead_weeks_max ||
      row.studio_style_notes || (row.style_tags?.length) || (row.preferred_materials?.length) ||
      (row.preferred_categories?.length) || (row.preferred_designers?.length)
    );
  }, [row]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const budgetCents = budgetStr.trim() ? Math.round(Number(budgetStr.replace(/[^\d.]/g, "")) * 100) : null;
      const leadWeeks = leadStr.trim() ? Math.max(0, Math.round(Number(leadStr))) : null;
      const patch = {
        user_id: user.id,
        default_deadline: row.default_deadline || null,
        default_budget_cents: budgetCents,
        default_currency: row.default_currency || (budgetCents ? "EUR" : null),
        preferred_lead_weeks_max: leadWeeks,
        studio_style_notes: (row.studio_style_notes || "").trim() || null,
        style_tags: csvToArr(stylesStr),
        preferred_materials: csvToArr(matsStr),
        preferred_categories: csvToArr(catsStr),
        preferred_designers: csvToArr(desStr),
        source: "manual",
      };
      const { error } = await supabase
        .from("trade_user_memory")
        .upsert(patch, { onConflict: "user_id" });
      if (error) throw error;
      toast({ title: "Studio memory saved", description: "The concierge will use these defaults from now on." });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message || "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    if (!user) return;
    if (!confirm("Wipe everything the concierge has learned about your studio?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("trade_user_memory").delete().eq("user_id", user.id);
      if (error) throw error;
      hydrate(EMPTY);
      toast({ title: "Studio memory cleared" });
    } catch (e: any) {
      toast({ title: "Couldn't clear", description: e?.message || "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-8 px-4 py-6 rounded-lg border border-border bg-card flex items-center justify-center">
        <DotCircleLoader />
      </div>
    );
  }

  return (
    <div className="mt-8 px-4 py-5 rounded-lg border border-border bg-card">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-9 w-9 rounded-full flex items-center justify-center bg-foreground/5 text-foreground">
          <Brain className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm text-foreground">Studio Memory</div>
          <div className="font-body text-xs text-muted-foreground mt-0.5">
            Standing defaults the concierge recalls automatically — deadline, budget, currency, lead-time ceiling, and your studio's style fingerprint.
            {row.updated_at && (
              <> &middot; updated {new Date(row.updated_at).toLocaleDateString()}</>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Standing deadline</span>
          <input
            type="date"
            value={row.default_deadline || ""}
            onChange={(e) => setRow({ ...row, default_deadline: e.target.value || null })}
            className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-foreground font-body text-sm"
          />
        </label>

        <label className="block">
          <span className="font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Lead-time ceiling (weeks)</span>
          <input
            type="number"
            min={0}
            value={leadStr}
            onChange={(e) => setLeadStr(e.target.value)}
            placeholder="e.g. 16"
            className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-foreground font-body text-sm"
          />
        </label>

        <label className="block">
          <span className="font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Standing budget</span>
          <div className="mt-1 flex gap-2">
            <select
              value={row.default_currency || "EUR"}
              onChange={(e) => setRow({ ...row, default_currency: e.target.value })}
              className="px-2 py-2 border border-border rounded-md bg-background text-foreground font-body text-sm"
            >
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="USD">USD</option>
              <option value="HKD">HKD</option>
              <option value="AED">AED</option>
            </select>
            <input
              type="text"
              inputMode="numeric"
              value={budgetStr}
              onChange={(e) => setBudgetStr(e.target.value)}
              placeholder="e.g. 250000"
              className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground font-body text-sm"
            />
          </div>
        </label>

        <label className="block">
          <span className="font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Style tags (comma-separated)</span>
          <input
            type="text"
            value={stylesStr}
            onChange={(e) => setStylesStr(e.target.value)}
            placeholder="e.g. minimalist, warm modern, art deco"
            className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-foreground font-body text-sm"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Studio style notes</span>
          <textarea
            value={row.studio_style_notes || ""}
            onChange={(e) => setRow({ ...row, studio_style_notes: e.target.value })}
            rows={3}
            placeholder="One paragraph the concierge should keep in mind on every brief — palette, materials, restraint level, recurring designers, anything to avoid."
            className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-foreground font-body text-sm leading-relaxed resize-y"
          />
        </label>

        <label className="block">
          <span className="font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Preferred materials</span>
          <input
            type="text"
            value={matsStr}
            onChange={(e) => setMatsStr(e.target.value)}
            placeholder="e.g. patinated brass, oak, alabaster"
            className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-foreground font-body text-sm"
          />
        </label>

        <label className="block">
          <span className="font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Preferred categories</span>
          <input
            type="text"
            value={catsStr}
            onChange={(e) => setCatsStr(e.target.value)}
            placeholder="e.g. lighting, seating, rugs"
            className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-foreground font-body text-sm"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Preferred designers</span>
          <input
            type="text"
            value={desStr}
            onChange={(e) => setDesStr(e.target.value)}
            placeholder="e.g. Thierry Lemaire, Apparatus, Pouenat"
            className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-foreground font-body text-sm"
          />
        </label>
      </div>

      {row.last_brief_summary && (
        <div className="mt-4 px-3 py-2 rounded-md bg-muted/40 border border-border">
          <div className="font-body text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Last brief the concierge recalled</div>
          <div className="font-body text-xs text-foreground mt-1 leading-relaxed">{row.last_brief_summary}</div>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={saving || !hasAny}
          onClick={clearAll}
          className="inline-flex items-center gap-2 px-3 py-2 text-foreground/70 hover:text-destructive font-body text-xs uppercase tracking-[0.1em] disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear memory
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="inline-flex items-center gap-2 px-4 py-2 border border-foreground bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save memory"}
        </button>
      </div>
    </div>
  );
}
