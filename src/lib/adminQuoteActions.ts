import { supabase } from "@/integrations/supabase/client";

export function quotePricingLines(items: Array<{ id: string }>, prices: Record<string, string>) {
  return items.map(item => {
    const raw = prices[item.id]?.trim();
    const cents = raw ? Math.round(Number(raw) * 100) : NaN;
    if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Enter a valid price for every piece.");
    return { id: item.id, cents };
  });
}

export async function saveAdminQuotePricing(quoteId: string, lines: Array<{ id: string; cents: number }>, notes: string, settings: { cbm: number; kg: number; mode: string }) {
  const { data, error } = await supabase.rpc("admin_save_quote_pricing", { _quote_id: quoteId, _lines: lines, _notes: notes, _cbm: settings.cbm, _kg: settings.kg, _mode: settings.mode });
  if (error || !data) throw error || new Error("Pricing was not saved.");
  return data;
}

export async function reviseAdminQuote(quoteId: string, notes: string) {
  const { data, error } = await supabase.rpc("admin_revise_quote_with_result", { _quote_id: quoteId, _notes: notes });
  if (error || !data || typeof data !== "object" || Array.isArray(data) || typeof data.draft_id !== "string" || typeof data.created !== "boolean") throw error || new Error("The draft could not be opened.");
  return { draftId: data.draft_id, created: data.created };
}