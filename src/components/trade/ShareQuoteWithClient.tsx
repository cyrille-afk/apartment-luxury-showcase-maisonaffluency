import { useEffect, useId, useState } from "react";
import { Link2, Loader2, Check, Ban, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildSharedQuoteSnapshot, type ShareSourceLine } from "@/lib/quoteClientShare";
// quoteShareUrl locks client-facing addresses to PRODUCTION_ORIGIN.
import { namedQuoteShareUrl, quoteShareSlug } from "@/lib/quoteSharePresentation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ITEM_SELECT =
  "image_url, quantity, unit_price_cents, unit_price_currency, variant_label, fabric_id, fabric_upcharge_cents, fabric_currency, fabric:fabrics!fabric_id(name, price_per_lm_cents, currency), wood_fabric:fabrics!trade_quote_items_wood_fabric_id_fkey(name), product:trade_products(product_name, brand_name, image_url, rrp_price_cents, currency, dimensions, materials, available_finishes, size_variants)";

/** Creates a retail-only, expiring client link (30 days) for a quote. */
export default function ShareQuoteWithClient({ quoteId }: { quoteId: string }) {
  const [busy, setBusy] = useState<"share" | "revoke" | "save" | null>(null);
  const [email, setEmail] = useState("");
  const [loadedQuoteId, setLoadedQuoteId] = useState<string | null>(null);
  const emailId = useId();
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const notify = (message: string, error = false) => {
    setFeedback({ error, message });
    if (error) toast.error(message);
    else toast.success(message);
  };

  useEffect(() => {
    let cancelled = false;
    setEmail("");
    setFeedback(null);
    setCopied(false);
    setLoadedQuoteId(null);
    const load = async () => {
      const { data, error } = await supabase.from("trade_quotes")
        .select("end_client_billing, client:clients(client_contacts(email, is_primary, created_at)), source_inquiry:inquiries!trade_quotes_source_inquiry_id_fkey(email)")
        .eq("id", quoteId).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setFeedback({ error: true, message: "The saved recipient couldn't be loaded. Please try again." });
      } else {
        const billing = data.end_client_billing;
        const billingEmail = billing && typeof billing === "object" && !Array.isArray(billing) && typeof billing.email === "string" ? billing.email : "";
        const contacts = [...(data.client?.client_contacts ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.created_at.localeCompare(b.created_at));
        setEmail(billingEmail.trim() || contacts.find(contact => contact.email?.trim())?.email || data.source_inquiry?.email || "");
      }
      setLoadedQuoteId(quoteId);
    };
    void load();
    return () => { cancelled = true; };
  }, [quoteId]);

  const saveRecipient = async () => {
    const recipient = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      notify("Enter a valid client email before sharing.", true);
      return false;
    }
    // Re-read immediately before merging so unrelated billing fields survive.
    const { data: quote, error } = await supabase.from("trade_quotes").select("end_client_billing").eq("id", quoteId).single();
    if (error || !quote) throw error ?? new Error("Quote unavailable");
    const billing = quote.end_client_billing;
    const saved = await supabase.from("trade_quotes").update({
      end_client_billing: { ...(billing && typeof billing === "object" && !Array.isArray(billing) ? billing : {}), email: recipient },
    }).eq("id", quoteId).select("id").single();
    if (saved.error || !saved.data) throw saved.error ?? new Error("Recipient not saved");
    setEmail(recipient);
    return true;
  };

  const save = async () => {
    setBusy("save");
    setFeedback(null);
    try {
      if (await saveRecipient()) notify("Client email saved.");
    } catch {
      notify("The client email couldn't be saved. Please try again.", true);
    } finally { setBusy(null); }
  };

  const share = async () => {
    setBusy("share");
    setFeedback(null);
    try {
      if (!await saveRecipient()) return;
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
    <span className="inline-flex w-full min-w-0 flex-col gap-2 text-left sm:w-auto">
      <label htmlFor={emailId} className="font-body text-xs text-muted-foreground">Client email</label>
      <span className="flex min-w-0 items-center gap-2">
        <Input id={emailId} type="email" autoComplete="email" placeholder="client@example.com" value={loadedQuoteId === quoteId ? email : ""}
          onChange={event => { setEmail(event.target.value); setFeedback(null); setCopied(false); }}
          disabled={!!busy || loadedQuoteId !== quoteId} aria-invalid={feedback?.error || undefined}
          className="h-9 min-w-0 sm:w-64" />
        <Button variant="ghost" size="icon" type="button" onClick={save} disabled={!!busy || loadedQuoteId !== quoteId}
          title="Save client email" aria-label="Save client email" className="h-9 w-9 shrink-0">
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        </Button>
      </span>
      <span className="inline-flex flex-wrap items-center gap-3">
      <Button variant="link" type="button" onClick={share} disabled={!!busy || loadedQuoteId !== quoteId} className={cls} title="Save the recipient and copy a retail-only quote link">
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
