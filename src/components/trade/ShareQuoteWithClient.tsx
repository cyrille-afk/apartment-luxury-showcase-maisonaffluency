import { useState } from "react";
import { Link2, Loader2, Check, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildSharedQuoteSnapshot, type ShareSourceLine } from "@/lib/quoteClientShare";
// quoteShareUrl locks client-facing addresses to PRODUCTION_ORIGIN.
import { namedQuoteShareUrl, quoteShareSlug } from "@/lib/quoteSharePresentation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const ITEM_SELECT =
  "image_url, quantity, unit_price_cents, unit_price_currency, variant_label, fabric_id, fabric_upcharge_cents, fabric_currency, fabric:fabrics!fabric_id(name, price_per_lm_cents, currency), wood_fabric:fabrics!trade_quote_items_wood_fabric_id_fkey(name), product:trade_products(product_name, brand_name, image_url, rrp_price_cents, currency, dimensions, materials, available_finishes, size_variants)";

/** Creates a retail-only, expiring client link (30 days) for a quote. */
export default function ShareQuoteWithClient({ quoteId }: { quoteId: string }) {
  const [busy, setBusy] = useState<"share" | "revoke" | null>(null);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const notify = (message: string, error = false) => {
    setFeedback({ error, message });
    if (error) toast.error(message);
    else toast.success(message);
  };

  const share = async () => {
    setBusy("share");
    setFeedback(null);
    try {
      const [{ data: quote, error: quoteError }, { data: items, error }] = await Promise.all([
        supabase.from("trade_quotes").select("client_name").eq("id", quoteId).maybeSingle(),
        supabase.from("trade_quote_items").select(ITEM_SELECT).eq("quote_id", quoteId).order("created_at"),
      ]);
      if (quoteError) throw quoteError;
      if (error) throw error;
      if (!items?.length) { notify("Add at least one piece before sharing this quote.", true); return; }
      const snapshot = buildSharedQuoteSnapshot(quoteId, quote?.client_name ?? null, items as unknown as ShareSourceLine[]);
      const { data: slug, error: rpcError } = await supabase.rpc("create_named_quote_share", { _quote_id: quoteId, _snapshot: snapshot as never, _slug: quoteShareSlug(snapshot) });
      if (rpcError || !slug) {
        if (rpcError?.message.includes("save client email")) { notify("Save the client's email in this quote before sharing.", true); return; }
        throw rpcError;
      }
      // Client-facing links must use the production domain — the preview origin
      // (lovableproject.com / id-preview--*.lovable.app) is useless to recipients.
      const url = namedQuoteShareUrl(slug);
      await navigator.clipboard.writeText(url);
      window.__lovableEvents?.track?.("project.client_link_copied", { link_type: "quote" });
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      notify("Client link copied — email verification required, valid for 30 days.");
    } catch {
      notify("The client link couldn't be created or copied. Please try again.", true);
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    setBusy("revoke");
    setFeedback(null);
    try {
      const { data, error } = await supabase.rpc("revoke_quote_client_shares", { _quote_id: quoteId });
      if (error) throw error;
      notify(data ? `${data} client link${data === 1 ? "" : "s"} revoked.` : "No active client links.");
    } catch {
      notify("Links couldn't be revoked. Please try again.", true);
    } finally { setBusy(null); }
  };

  const cls = "h-auto min-w-0 whitespace-normal justify-start p-0 gap-1 font-body text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground";
  return (
    <span className="inline-flex min-w-0 flex-col gap-2 text-left">
      <span className="inline-flex flex-wrap items-center gap-3">
      <Button variant="link" type="button" onClick={share} disabled={!!busy} className={cls} title="Copy a retail-only link to present this quote">
        {busy === "share" ? <Loader2 className="h-3 w-3 animate-spin" /> : copied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
        {busy === "share" ? "Creating link…" : copied ? "Link copied" : "Share with client"}
      </Button>
      <Button variant="link" type="button" onClick={revoke} disabled={!!busy} className={cls} title="Disable every client link for this quote">
        {busy === "revoke" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
        Revoke links
      </Button>
      </span>
      {feedback && <span role={feedback.error ? "alert" : "status"} className={`font-body text-xs normal-case tracking-normal ${feedback.error ? "text-destructive" : "text-muted-foreground"}`}>{feedback.message}</span>}
    </span>
  );
}
