/**
 * Quote Extras Editor
 * -------------------
 * Inline CRUD list of additional fixed charges on a trade quote
 * (e.g. crating, hand-loading, surcharges). Stored in `trade_quote_extras`.
 *
 * Extras are kept *outside* the items table because they are not products
 * (no SKU, no shipping CBM/weight, no trade discount, no insurance base).
 * Totals integration:
 *   - Added to the quote grand total in the default totals breakdown.
 *   - Passed to UK/HK landed-cost panels which fold them into their totals
 *     after FX conversion (no duty / VAT applied — services are out of scope
 *     of the goods-based DDP/DAP calculation).
 */
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
const formatPriceRaw = (cents: number, currency: string) => {
  const v = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  } catch {
    return v.toFixed(2);
  }
};
const currencySymbol = (c: string) => ({ EUR: "€", USD: "$", GBP: "£", SGD: "S$", HKD: "HK$" }[c.toUpperCase()] ?? c);

type Extra = {
  id: string;
  label: string;
  amount_cents: number;
  currency: string | null;
  sort_order: number;
};

interface Props {
  quoteId: string;
  currency: string;
  isReadOnly?: boolean;
  /** Called whenever the total of all extras changes, converted to the quote (display) currency in cents. */
  onTotalChange?: (totalCents: number) => void;
  /** Convert cents between currencies via the parent's live FX rates. */
  convertCents?: (cents: number | null, from: string, to: string) => number | null;
}

export const QuoteExtrasEditor = ({ quoteId, currency, isReadOnly = false, onTotalChange, convertCents }: Props) => {
  const { toast } = useToast();
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftAmount, setDraftAmount] = useState("");

  const toDisplay = (cents: number, from: string): number => {
    const src = (from || currency).toUpperCase();
    const tgt = currency.toUpperCase();
    if (src === tgt) return cents;
    if (convertCents) {
      const v = convertCents(cents, src, tgt);
      return typeof v === "number" ? v : cents;
    }
    return cents;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("trade_quote_extras" as any)
        .select("id, label, amount_cents, currency, sort_order")
        .eq("quote_id", quoteId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        // Non-fatal: table might not exist on older deploys.
        setExtras([]);
      } else {
        setExtras((data as unknown as Extra[]) || []);
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [quoteId]);

  useEffect(() => {
    const totalInDisplay = extras.reduce(
      (s, e) => s + toDisplay(e.amount_cents || 0, e.currency || currency),
      0,
    );
    onTotalChange?.(totalInDisplay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extras, currency, convertCents]);

  const handleAdd = async () => {
    const label = draftLabel.trim();
    const amountEur = parseFloat(draftAmount);
    if (!label || !Number.isFinite(amountEur)) {
      toast({ title: "Add an extra", description: "Provide a label and amount.", variant: "destructive" });
      return;
    }
    const amountCents = Math.round(amountEur * 100);
    const nextSort = extras.length ? Math.max(...extras.map((e) => e.sort_order)) + 1 : 0;
    const { data, error } = await supabase
      .from("trade_quote_extras" as any)
      .insert({ quote_id: quoteId, label, amount_cents: amountCents, currency, sort_order: nextSort })
      .select("id, label, amount_cents, currency, sort_order")
      .single();
    if (error || !data) {
      toast({ title: "Error", description: error?.message ?? "Could not add extra", variant: "destructive" });
      return;
    }
    setExtras((prev) => [...prev, data as unknown as Extra]);
    setDraftLabel("");
    setDraftAmount("");
  };

  const handleRemove = async (id: string) => {
    const prev = extras;
    setExtras((curr) => curr.filter((e) => e.id !== id));
    const { error } = await supabase.from("trade_quote_extras" as any).delete().eq("id", id);
    if (error) {
      setExtras(prev);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = async (id: string, patch: Partial<Pick<Extra, "label" | "amount_cents">>) => {
    setExtras((curr) => curr.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const { error } = await supabase.from("trade_quote_extras" as any).update(patch).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const total = extras.reduce((s, e) => s + (e.amount_cents || 0), 0);

  if (loading) return null;
  if (isReadOnly && extras.length === 0) return null;

  return (
    <div className="border border-border rounded-md bg-background/40 p-3 mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-[11px] uppercase tracking-wider text-foreground/80">
          Additional charges
        </span>
        {total > 0 && (
          <span className="font-body text-xs text-muted-foreground tabular-nums">
            Total: {currencySymbol(currency)}{formatPriceRaw(total, currency)}
          </span>
        )}
      </div>

      {extras.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {extras.map((e) => (
            <div key={e.id} className="flex items-center gap-2">
              {isReadOnly ? (
                <>
                  <span className="flex-1 font-body text-xs text-foreground truncate">{e.label}</span>
                  <span className="font-body text-xs text-foreground tabular-nums">
                    {currencySymbol(currency)}{formatPriceRaw(e.amount_cents, currency)}
                  </span>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={e.label}
                    onChange={(ev) =>
                      setExtras((curr) => curr.map((x) => (x.id === e.id ? { ...x, label: ev.target.value } : x)))
                    }
                    onBlur={(ev) => handleEdit(e.id, { label: ev.target.value.trim() || "Charge" })}
                    className="flex-1 bg-background border border-border rounded px-2 py-1 font-body text-xs text-foreground"
                  />
                  <div className="flex items-center gap-1">
                    <span className="font-body text-xs text-muted-foreground">{currencySymbol(currency)}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={(e.amount_cents / 100).toString()}
                      onChange={(ev) => {
                        const v = parseFloat(ev.target.value);
                        const cents = Number.isFinite(v) ? Math.round(v * 100) : 0;
                        setExtras((curr) => curr.map((x) => (x.id === e.id ? { ...x, amount_cents: cents } : x)));
                      }}
                      onBlur={(ev) => {
                        const v = parseFloat(ev.target.value);
                        handleEdit(e.id, { amount_cents: Number.isFinite(v) ? Math.round(v * 100) : 0 });
                      }}
                      className="w-24 bg-background border border-border rounded px-2 py-1 font-body text-xs text-foreground tabular-nums text-right"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(e.id)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remove charge"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {!isReadOnly && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
          <input
            type="text"
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            placeholder="e.g. Crating, hand-loading, rush surcharge…"
            className="flex-1 bg-background border border-border rounded px-2 py-1 font-body text-xs text-foreground"
          />
          <div className="flex items-center gap-1">
            <span className="font-body text-xs text-muted-foreground">{currencySymbol(currency)}</span>
            <input
              type="number"
              step="0.01"
              value={draftAmount}
              onChange={(e) => setDraftAmount(e.target.value)}
              placeholder="0.00"
              className="w-24 bg-background border border-border rounded px-2 py-1 font-body text-xs text-foreground tabular-nums text-right"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1 px-2 py-1 border border-border rounded font-body text-[11px] uppercase tracking-wider text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      )}
    </div>
  );
};

export default QuoteExtrasEditor;
