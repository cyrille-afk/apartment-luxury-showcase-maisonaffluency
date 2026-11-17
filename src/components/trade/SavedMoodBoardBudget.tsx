import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MoodBoardBudgetBar, MoodBoardBudgetControls } from "./MoodBoardBudgetControls";
import { convertMoodBudget, emptyMoodBudget, moodBudgetLedger, type MoodBudgetSettings, type MoodCurrency } from "@/lib/moodBoardBudget";
import { boardMatrixPrice } from "@/lib/boardMatrixPrice";
import { moodRetailEur } from "@/lib/moodBoardDetails";
import { getFxRate } from "@/lib/fxRates";
import { readStudioRoomContext, saveStudioRoomContext } from "@/lib/studioRoomContext";
import { initialSavedMoodBudget, savedMoodBudgetKey } from "@/lib/savedMoodBoardBudget";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@/lib/router-compat";
import { ArrowRight } from "lucide-react";

type Item = { id: string; product_id: string; variant_label: string | null; product?: { product_name: string; source_pick_id?: string | null } };
export function SavedMoodBoardBudget({ boardId, projectId, items, finishes, editable }: {
  boardId: string; projectId: string | null; items: Item[];
  finishes: Record<string, { label: string; price_cents: number | null }>;
  editable: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<MoodBudgetSettings>(emptyMoodBudget);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const key = user ? savedMoodBudgetKey(user.id, boardId) : null;
  const ids = useMemo(() => [...new Set(items.map(item => item.product_id))].sort(), [items]);
  useEffect(() => {
    if (!user || !key) return;
    let alive = true;
    setReadyKey(null);
    void (async () => {
      let saved: MoodBudgetSettings | null = null;
      try { saved = JSON.parse(localStorage.getItem(key) || "null"); } catch { /* unavailable */ }
      const room = projectId ? readStudioRoomContext(user.id, projectId, items.flatMap(item => [item.product_id, item.product?.source_pick_id ?? ""])) : null;
      const result = projectId && !saved && !room ? await supabase.from("projects").select("target_ceiling_cents, ceiling_currency").eq("id", projectId).maybeSingle() : null;
      if (!alive) return;
      setSettings(initialSavedMoodBudget(saved, room, result?.data));
      setReadyKey(key);
    })();
    return () => { alive = false; };
  }, [key, user?.id, projectId]);
  const { data: catalogue = [], isPending, isError } = useQuery({
    queryKey: ["saved-mood-board-budget-prices", user?.id, ids], enabled: !!user && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("trade_products").select("id, category, subcategory, trade_price_cents, rrp_price_cents, size_variants, currency").in("id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });
  const currency = settings.currency ?? "EUR";
  const { data: rate = 1, isPending: ratePending, isError: rateError } = useQuery({ queryKey: ["mood-board-fx", currency], queryFn: () => getFxRate("EUR", currency), staleTime: 600000 });
  const { data: prices = new Map(), isPending: finishPending, isError: finishError } = useQuery({
    queryKey: ["saved-mood-board-configured-budget", catalogue, items.map(i => [i.id, i.product_id, i.variant_label, finishes[i.id]?.label, finishes[i.id]?.price_cents])],
    enabled: ids.length > 0 && !isPending && !isError,
    queryFn: async () => new Map(await Promise.all(items.map(async item => {
      const product = catalogue.find(p => p.id === item.product_id);
      const finish = finishes[item.id] ?? { label: item.variant_label ?? "", price_cents: null };
      const price = boardMatrixPrice(product?.trade_price_cents ?? product?.rrp_price_cents, product?.size_variants, finish);
      return [item.id, { retail: await moodRetailEur(price.cents, product?.currency), trade: null }] as const;
    }))),
  });
  const ledger = moodBudgetLedger(items.map(item => {
    const product = catalogue.find(p => p.id === item.product_id);
    return { id: item.id, product_name: item.product?.product_name, category: product?.category ?? "", subcategory: product?.subcategory ?? "" };
  }), prices, settings, rate);
  const pending = readyKey !== key || (items.length > 0 && (isPending || finishPending)) || ratePending || isError || finishError || rateError;
  const change = (next: MoodBudgetSettings) => {
    if (!key || readyKey !== key) return;
    setSettings(next);
    try { localStorage.setItem(key, JSON.stringify(next)); setNotice(null); }
    catch { setNotice("This browser couldn’t save your budget. Keep this page open and try again."); }
  };
  const changeCurrency = async (next: MoodCurrency) => {
    try { change(convertMoodBudget(settings, next, await getFxRate(currency, next))); }
    catch { setNotice("Currency conversion is unavailable. Please try again."); }
  };
  return <section aria-label="Saved mood board budget" className="mb-8 space-y-4">
    {editable && readyKey === key && <MoodBoardBudgetControls settings={settings} onChange={change} onCurrencyChange={next => void changeCurrency(next)} />}
    <MoodBoardBudgetBar ledger={ledger} pending={pending} currency={currency} />
    {(notice || isError || finishError || rateError) && <p role="status" className="text-xs text-destructive">{notice ?? "Budget prices couldn’t be confirmed. Please reload to try again."}</p>}
    {projectId && editable && <div className="flex justify-end"><Button size="sm" className="gap-2" onClick={() => {
      if (user && readyKey === key) saveStudioRoomContext(user.id, projectId, { roomType: settings.roomType, currency, targetCents: ledger.total, anchorId: readStudioRoomContext(user.id, projectId, items.flatMap(item => [item.product_id, item.product?.source_pick_id ?? ""]))?.anchorId ?? null });
      navigate(`/trade/projects/${projectId}/studio?board=${encodeURIComponent(boardId)}`);
    }}>Project Studio <ArrowRight className="h-3.5 w-3.5" /></Button></div>}
  </section>;
}