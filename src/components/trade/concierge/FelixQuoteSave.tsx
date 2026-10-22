import { useRef, useState } from "react";
import { Save, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { toast } from "sonner";
import { prepareFelixQuote } from "@/lib/felixQuoteSave";
import { felixQuoteTotals, formatFelixMoney } from "@/lib/felixQuoteQuantity";
import type { ProactiveTearsheetData } from "./ProactiveTearsheetCard";

export function FelixQuoteSave({ cards, projectId, onSaved, onRestore }: {
  cards?: ProactiveTearsheetData[]; projectId?: string | null;
  onSaved?: (cards: ProactiveTearsheetData[]) => void;
  onRestore?: (cards: ProactiveTearsheetData[]) => void;
}) {
  const { user } = useAuth();
  const { currentStudio, canEdit } = useStudio();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Array<{ id: string; felix_snapshot: unknown }>>([]);
  const pending = useRef<ProactiveTearsheetData[] | null>(null);
  if (!user) return null;
  const save = async () => {
    if (!cards?.length || busy) return;
    if (currentStudio && !canEdit) { toast.error("You do not have permission to edit studio quotes."); return; }
    setBusy(true);
    const quoteId = cards.find(c => c.savedQuoteId)?.savedQuoteId || pending.current?.[0]?.savedQuoteId || crypto.randomUUID();
    const prepared = prepareFelixQuote(cards.map(c => {
      const previous = pending.current?.find(p => p.productId === c.productId);
      return previous ? { ...c, savedQuoteId: previous.savedQuoteId, savedLineId: previous.savedLineId } : c;
    }), quoteId);
    pending.current = prepared;
    try {
      // The SQL RPC accepts null studio/project IDs for personal, unassigned quotes.
      const saveQuote = supabase.rpc.bind(supabase) as (
        name: "save_felix_quote",
        args: { p_id: string; p_studio_id: string | null; p_project_id: string | null; p_cards: Json },
      ) => ReturnType<typeof supabase.rpc>;
      const { error } = await saveQuote("save_felix_quote", { p_id: quoteId, p_studio_id: currentStudio?.id ?? null, p_project_id: projectId ?? null, p_cards: prepared as unknown as Json });
      if (error) throw error;
      onSaved?.(prepared); pending.current = null;
      toast.success(`${guideName} quote saved`);
    } catch { toast.error("Could not save quote. Please retry."); }
    finally { setBusy(false); }
  };
  const load = async () => {
    setBusy(true);
    const { data, error } = await supabase.from("trade_quotes").select("id,felix_snapshot").eq("user_id", user.id).eq("status", "draft").not("felix_snapshot", "is", null).order("created_at", { ascending: false });
    setBusy(false);
    if (error) { toast.error("Could not load saved quotes."); return; }
    setSaved(data || []); setOpen(true);
  };
  return <div data-trade-sensitive className="flex flex-wrap gap-2 px-3 py-2">
    {cards && <Button size="sm" variant="outline" disabled={busy || !cards.length} onClick={save} aria-label={`Save ${guideName} quote`}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}<span className="ml-2">Save Quote</span></Button>}
    {onRestore && <Button size="sm" variant="ghost" disabled={busy} onClick={load} aria-label={`Open saved ${guideName} quotes`}><FolderOpen className="h-3.5 w-3.5" /><span className="ml-2">Saved Quotes</span></Button>}
    <Sheet open={open} onOpenChange={setOpen}><SheetContent side="left" className="z-[10030] overflow-y-auto" aria-describedby={undefined}>
      <h2 className="font-display text-lg mb-6">Saved {guideName} Quotes</h2>
      {!saved.length && <p className="text-muted-foreground text-sm">No saved {guideName} drafts.</p>}
      {saved.map(quote => {
        const lines = Array.isArray(quote.felix_snapshot) ? quote.felix_snapshot as ProactiveTearsheetData[] : [];
        return <Button key={quote.id} variant="ghost" className="w-full h-auto py-4 justify-start border-b border-border rounded-none text-left whitespace-normal" onClick={() => { pending.current = null; onRestore?.(lines); setOpen(false); }}>
          <span className="min-w-0"><span className="block">QU-{quote.id.slice(0, 6).toUpperCase()}</span><span className="block text-muted-foreground text-xs">{lines.map(c => c.productName).join(" · ")}</span>{felixQuoteTotals(lines).map(t => <span key={t.currency} className="block text-xs mt-1">{formatFelixMoney(t.cents, t.currency)}{t.incomplete ? " + Price upon Request" : ""}</span>)}</span>
        </Button>;
      })}
    </SheetContent></Sheet>
  </div>;
}