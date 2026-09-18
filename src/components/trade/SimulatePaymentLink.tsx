import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Dev-only testing utility: spoofs a `payment_intent.succeeded` webhook for a
 * single pipeline card so the automated column transitions can be exercised
 * without touching Stripe.
 *
 * First click  -> card is marked `paid`    (drops into Awaiting Settlement).
 * Second click -> card is marked `settled` (drops into Conversions).
 *
 * Rendered in dev and in the Lovable preview (both run Vite dev mode), but
 * never in the published production build, where import.meta.env.DEV is false.
 */
const isLocalDevHost = () => {
  return import.meta.env.DEV;
};

export default function SimulatePaymentLink({
  cardId,
  cardStage,
  label,
  email,
  quoteId,
  alreadyPaid = false,
}: {
  cardId: string;
  cardStage: string;
  label: string;
  email?: string | null;
  quoteId?: string | null;
  alreadyPaid?: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  if (!isLocalDevHost()) return null;

  const simulate = async () => {
    setBusy(true);
    try {
      const { data: existing, error: readError } = await supabase
        .from("funnel_card_payments")
        .select("id, status")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (readError) throw readError;

      const row = existing?.[0];
      const nowIso = new Date().toISOString();

      if (row && row.status !== "settled") {
        const { error } = await supabase
          .from("funnel_card_payments")
          .update({ status: "settled", paid_at: nowIso })
          .eq("id", row.id);
        if (error) throw error;
      } else if (!row) {
        const { error } = await supabase.from("funnel_card_payments").insert({
          card_id: cardId,
          card_stage: cardStage,
          label,
          amount_cents: 0,
          currency: "USD",
          payment_kind: "deposit",
          status: "paid",
          paid_at: nowIso,
          stripe_payment_intent_id: `pi_simulated_${cardId.slice(0, 8)}_${Date.now()}`,
          payer_email: email ?? null,
          quote_id: quoteId ?? null,
        });
        if (error) throw error;
      }

      await qc.invalidateQueries({ queryKey: ["sales-funnel"] });
    } catch (e) {
      toast({
        title: "Simulation failed",
        description: e instanceof Error ? e.message : "Could not spoof the payment event",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 border-t border-dashed border-border/60 pt-1.5 text-center">
      <button
        type="button"
        onClick={simulate}
        disabled={busy}
        className="font-body text-[10px] tracking-[0.08em] text-muted-foreground/70 underline-offset-2 transition-colors hover:text-muted-foreground hover:underline disabled:opacity-50"
      >
        {busy ? "Simulating…" : alreadyPaid ? "⚙️ Simulate settlement" : "⚙️ Simulate success"}
      </button>
    </div>
  );
}
