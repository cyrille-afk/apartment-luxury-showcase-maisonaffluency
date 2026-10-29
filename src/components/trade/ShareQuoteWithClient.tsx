import { useState } from "react";
import { Link2, Loader2, Check, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildSharedQuoteSnapshot, type ShareSourceLine } from "@/lib/quoteClientShare";
import { toast } from "sonner";

const ITEM_SELECT =
  "image_url, quantity, unit_price_cents, unit_price_currency, variant_label, fabric_id, fabric_upcharge_cents, fabric_currency, fabric:fabrics!fabric_id(name, price_per_lm_cents, currency), wood_fabric:fabrics!trade_quote_items_wood_fabric_id_fkey(name), product:trade_products(product_name, brand_name, image_url, rrp_price_cents, currency, dimensions, size_variants)";

/** Creates a retail-only, expiring client link (30 days) for a quote. */
export default function ShareQuoteWithClient({ quoteId }: { quoteId: string }) {
  const [busy, setBusy] = useState<"share" | "revoke" | null>(null);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    setBusy("share");
    try {
      const [{ data: quote }, { data: items, error }] = await Promise.all([
        supabase.from("trade_quotes").select("client_name").eq("id", quoteId).maybeSingle(),
        supabase.from("trade_quote_items").select(ITEM_SELECT).eq("quote_id", quoteId).order("created_at"),
      ]);
      if (error) throw error;
      if (!items?.length) { toast.error("Add at least one piece before sharing this quote."); return; }
      const snapshot = buildSharedQuoteSnapshot(quoteId, quote?.client_name ?? null, items as unknown as ShareSourceLine[]);
      const { data: token, error: rpcError } = await supabase.rpc("create_quote_client_share", { _quote_id: quoteId, _snapshot: snapshot as never });
      if (rpcError || !token) throw rpcError;
      const url = `${window.location.origin}/quote/${token}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success("Client link copied — retail prices only, valid for 30 days.");
    } catch {
      toast.error("The client link couldn't be created. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    setBusy("revoke");
    const { data, error } = await supabase.rpc("revoke_quote_client_shares", { _quote_id: quoteId });
    setBusy(null);
    if (error) toast.error("Links couldn't be revoked. Please try again.");
    else toast.success(data ? `${data} client link${data === 1 ? "" : "s"} revoked.` : "No active client links.");
  };

  const cls = "inline-flex items-center gap-1 font-body text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50";
  return (
    <span className="inline-flex items-center gap-3">
      <button type="button" onClick={share} disabled={!!busy} className={cls} title="Copy a retail-only link to present this quote">
        {busy === "share" ? <Loader2 className="h-3 w-3 animate-spin" /> : copied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
        {copied ? "Link copied" : "Share with client"}
      </button>
      <button type="button" onClick={revoke} disabled={!!busy} className={cls} title="Disable every client link for this quote">
        {busy === "revoke" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
        Revoke links
      </button>
    </span>
  );
}
