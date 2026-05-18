import { useState } from "react";
import { Lock, Unlock, Layout, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useFfeEntitlement } from "@/hooks/useFfeEntitlement";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export function FfeUnlockTile({ userId, readOnly = false }: { userId?: string; readOnly?: boolean } = {}) {
  const {
    favoritesCount, favoritesRequired, meetsFavoritesThreshold,
    hasPaidEntitlement, hasPendingEntitlement, unlocked, loading,
  } = useFfeEntitlement(userId);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const progress = Math.min(100, Math.round((favoritesCount / favoritesRequired) * 100));

  const handleUnlock = async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-ffe-checkout", {});
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      toast({ title: "Could not start checkout", description: err.message, variant: "destructive" });
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return <div className="border border-border rounded-lg p-6 bg-muted/20 animate-pulse h-48" />;
  }

  return (
    <div className="border border-border rounded-lg p-6 bg-gradient-to-br from-muted/30 to-background relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[hsl(var(--gold))]/5 rounded-full blur-3xl" />
      <div className="relative">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-md bg-foreground/5 flex items-center justify-center">
            {unlocked ? <Unlock className="h-5 w-5 text-[hsl(var(--gold))]" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base text-foreground flex items-center gap-2">
              Floor Plan → FF&E Tool
              <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--gold))]" />
            </h3>
            <p className="font-body text-xs text-muted-foreground mt-0.5">
              Auto-place your favorites into a scaled floor plan
            </p>
          </div>
        </div>

        {!meetsFavoritesThreshold ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-xs text-muted-foreground">
                {favoritesCount} / {favoritesRequired} favorites
              </span>
              <span className="font-body text-[11px] text-muted-foreground">
                {favoritesRequired - favoritesCount} more to unlock
              </span>
            </div>
            <Progress value={progress} className="h-1.5 mb-4" />
            {!readOnly && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/trade/favorites")}>
                Browse the catalogue
              </Button>
            )}
          </>
        ) : unlocked ? (
          <Button
            className="w-full bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/90 text-background"
            onClick={() => navigate("/trade/tools/ffe")}
            disabled={readOnly}
          >
            <Layout className="h-4 w-4 mr-2" /> {readOnly ? "Unlocked" : "Open Floor Plan tool"}
          </Button>
        ) : hasPendingEntitlement ? (
          <div className="text-center py-2">
            <p className="font-body text-xs text-muted-foreground mb-2">Payment processing…</p>
            {!readOnly && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => window.location.reload()}>
                Refresh
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-3 p-3 rounded bg-[hsl(var(--gold))]/10 border border-[hsl(var(--gold))]/20">
              <p className="font-body text-[11px] text-foreground/80 leading-relaxed">
                <span className="font-medium">$100 unlock</span> — fully credited to your next trade quote.
              </p>
            </div>
            {!readOnly && (
              <Button
                className="w-full bg-foreground text-background hover:bg-foreground/90"
                onClick={handleUnlock}
                disabled={checkoutLoading || !hasPaidEntitlement && hasPendingEntitlement}
              >
                {checkoutLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirecting…</> : "Unlock for $100"}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
