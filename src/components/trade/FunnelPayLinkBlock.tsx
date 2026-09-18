import { useState } from "react";
import { Check, Loader2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CURRENCIES = ["USD", "EUR", "GBP", "SGD", "HKD", "AED", "CHF"] as const;
const SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  SGD: "S$",
  HKD: "HK$",
  AED: "AED",
  CHF: "CHF",
};

interface Props {
  label: string;
  email: string | null;
  quoteId?: string | null;
  className?: string;
}

const FunnelPayLinkBlock = ({ label, email, quoteId, className }: Props) => {
  const { toast } = useToast();
  const [currency, setCurrency] = useState<string>("USD");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    const value = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(value) || value < 1) {
      toast({ title: "Enter an amount first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-adhoc-payment-link", {
        body: {
          amountCents: Math.round(value * 100),
          currency,
          label,
          payerEmail: email,
          quoteId: quoteId ?? null,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error(data?.error || "No link returned");
      try {
        await navigator.clipboard.writeText(data.url);
      } catch {
        window.prompt("Copy this payment link", data.url);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 6000);
    } catch (err) {
      toast({
        title: "Could not create the payment link",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("mt-3 space-y-2 border-t border-border/70 pt-3 font-body", className)}>
      <div className="flex items-stretch border border-border bg-background focus-within:border-gold">
        <label className="sr-only" htmlFor={`amt-${quoteId ?? label}`}>
          Payment amount
        </label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          aria-label="Currency"
          className="border-r border-border bg-muted/50 px-2 font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground outline-none"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c} ({SYMBOL[c]})
            </option>
          ))}
        </select>
        <input
          id={`amt-${quoteId ?? label}`}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder="0.00"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 font-body text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      <Button
        type="button"
        size="sm"
        onClick={handleGenerate}
        disabled={loading}
        className={cn(
          "h-8 w-full rounded-none font-body text-[10px] font-semibold uppercase tracking-[0.14em]",
          copied
            ? "bg-emerald-600 text-white hover:bg-emerald-600"
            : "bg-gold text-accent-foreground hover:bg-gold/90",
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> Generating
          </>
        ) : copied ? (
          <>
            <Check className="h-3 w-3" /> Link copied
          </>
        ) : (
          <>
            <Zap className="h-3 w-3" /> Generate Stripe link
          </>
        )}
      </Button>
    </div>
  );
};

export default FunnelPayLinkBlock;
