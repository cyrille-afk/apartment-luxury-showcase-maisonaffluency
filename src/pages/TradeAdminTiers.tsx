import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, Award, Sparkles, TrendingUp, TrendingDown, Minus, Eye } from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

type Tier = "silver" | "gold" | "platinum";

interface TierRow {
  tier: Tier;
  label: string;
  discount_pct: number;     // 0–1
  min_spend_cents: number;  // cents
}

const TIER_ORDER: Tier[] = ["silver", "gold", "platinum"];

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);

export default function TradeAdminTiers() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<Tier, Partial<TierRow>>>({} as any);
  const [recomputing, setRecomputing] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-trade-tier-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("trade_tier_config")
        .select("tier, label, discount_pct, min_spend_cents");
      if (error) throw error;
      const list = (data || []) as TierRow[];
      // Sort by tier order
      list.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
      return list;
    },
    enabled: isAdmin,
  });

  const merged = useMemo<TierRow[]>(() => {
    return rows.map((r) => ({ ...r, ...(draft[r.tier] || {}) }));
  }, [rows, draft]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const setField = (tier: Tier, field: keyof TierRow, value: any) => {
    setDraft((d) => ({ ...d, [tier]: { ...d[tier], [field]: value } }));
  };

  const isDirty = (tier: Tier) => Object.keys(draft[tier] || {}).length > 0;
  const anyDirty = TIER_ORDER.some(isDirty);

  // Validation: thresholds must be strictly increasing silver < gold < platinum
  const orderingError = (() => {
    const s = merged.find((r) => r.tier === "silver")?.min_spend_cents ?? 0;
    const g = merged.find((r) => r.tier === "gold")?.min_spend_cents ?? 0;
    const p = merged.find((r) => r.tier === "platinum")?.min_spend_cents ?? 0;
    if (!(s <= g && g < p)) return "Thresholds must satisfy: Silver ≤ Gold < Platinum.";
    return null;
  })();

  const saveAll = async () => {
    if (orderingError) {
      toast({ title: "Cannot save", description: orderingError, variant: "destructive" });
      return;
    }
    for (const tier of TIER_ORDER) {
      const patch = draft[tier];
      if (!patch) continue;
      const clean: any = {};
      if (patch.label !== undefined) clean.label = patch.label;
      if (patch.discount_pct !== undefined) clean.discount_pct = patch.discount_pct;
      if (patch.min_spend_cents !== undefined) clean.min_spend_cents = patch.min_spend_cents;
      clean.updated_at = new Date().toISOString();
      const { error } = await (supabase as any)
        .from("trade_tier_config")
        .update(clean)
        .eq("tier", tier);
      if (error) {
        toast({ title: `Failed to save ${tier}`, description: error.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: "Tier configuration saved" });
    setDraft({} as any);
    qc.invalidateQueries({ queryKey: ["admin-trade-tier-config"] });
    qc.invalidateQueries({ queryKey: ["trade-tier-config"] });
  };

  const recomputeSuggestions = async () => {
    setRecomputing(true);
    const { data, error } = await (supabase as any).rpc("recompute_trade_tier_suggestions");
    setRecomputing(false);
    if (error) {
      toast({ title: "Recompute failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Recomputed ${data ?? 0} profile suggestions` });
  };

  return (
    <>
      <Helmet><title>Trade Tiers — Admin — Maison Affluency</title></Helmet>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/trade/admin-dashboard" className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
            <div>
              <h1 className="font-display text-2xl text-foreground">Trade Tiers</h1>
              <p className="font-body text-sm text-muted-foreground mt-0.5">
                Edit the Silver / Gold / Platinum discount % and the rolling 12-month spend thresholds used to suggest tier upgrades.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={recomputeSuggestions}
              disabled={recomputing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider font-body rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50"
              title="Recalculate every trade user's 12-month spend and suggested tier."
            >
              <Sparkles className="h-3 w-3" /> {recomputing ? "Recomputing…" : "Recompute suggestions"}
            </button>
            <button
              onClick={saveAll}
              disabled={!anyDirty || !!orderingError}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider font-body rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              <Save className="h-3 w-3" /> Save changes
            </button>
          </div>
        </div>

        {orderingError && (
          <div className="border border-destructive/30 bg-destructive/5 text-destructive font-body text-xs rounded-md px-3 py-2">
            {orderingError}
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {merged.map((row, idx) => {
              const dirty = isDirty(row.tier);
              const accent =
                row.tier === "platinum" ? "border-zinc-400 bg-zinc-50" :
                row.tier === "gold"     ? "border-amber-300 bg-amber-50/60" :
                                          "border-slate-300 bg-slate-50/60";
              const nextRow = merged[idx + 1];
              const upperLabel = nextRow ? `up to ${formatCurrency(nextRow.min_spend_cents)}` : "and above";
              return (
                <div
                  key={row.tier}
                  className={`rounded-lg border p-4 space-y-4 ${accent} ${dirty ? "ring-2 ring-primary/30" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-foreground/70" />
                    <input
                      className="font-display text-base bg-transparent border-b border-transparent focus:border-border outline-none w-full"
                      value={row.label}
                      onChange={(e) => setField(row.tier, "label", e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block font-body text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Discount %
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={0.1}
                        min={0}
                        max={100}
                        className="w-24 px-2 py-1.5 text-sm font-body rounded border border-border bg-background"
                        value={(row.discount_pct * 100).toString()}
                        onChange={(e) => {
                          const pct = e.target.value === "" ? 0 : Number(e.target.value);
                          setField(row.tier, "discount_pct", Math.max(0, Math.min(100, pct)) / 100);
                        }}
                      />
                      <span className="font-body text-xs text-muted-foreground">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-body text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Minimum 12-month spend (€)
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="font-body text-xs text-muted-foreground">€</span>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        className="w-full px-2 py-1.5 text-sm font-body rounded border border-border bg-background tabular-nums"
                        value={(row.min_spend_cents / 100).toString()}
                        onChange={(e) => {
                          const units = e.target.value === "" ? 0 : Number(e.target.value);
                          setField(row.tier, "min_spend_cents", Math.max(0, Math.round(units * 100)));
                        }}
                        disabled={row.tier === "silver"}
                      />
                    </div>
                    {row.tier === "silver" && (
                      <p className="mt-1 font-body text-[10px] text-muted-foreground">
                        Silver is the entry tier — threshold is fixed at €0.
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/60 font-body text-[11px] text-muted-foreground leading-relaxed">
                    Trade users with confirmed spend from{" "}
                    <span className="text-foreground font-medium">{formatCurrency(row.min_spend_cents)}</span>{" "}
                    {upperLabel} are auto-suggested for{" "}
                    <span className="text-foreground font-medium">{row.label}</span>.
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-[11px] font-body text-muted-foreground leading-relaxed border-t border-border pt-4">
          Tier assignments aren't applied automatically — they show as <em>suggestions</em> next to each user
          on the Registered Users page so the team can review and confirm. Saving changes here also updates
          the discount applied to all quotes for users in that tier.
        </div>
      </div>
    </>
  );
}
