import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, MapPin, FileText, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const WelcomeIntroDialog = () => {
  const { user, isTradeUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user || !isTradeUser || checked) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("has_seen_trade_intro")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setChecked(true);
      if (data && data.has_seen_trade_intro === false) setOpen(true);
    })();
    return () => { cancelled = true; };
  }, [user, isTradeUser, checked]);

  const dismiss = async () => {
    setOpen(false);
    if (user) {
      await supabase.from("profiles").update({ has_seen_trade_intro: true }).eq("id", user.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Welcome to Maison Affluency</DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground">
            Your trade account is approved. Here's where to begin:
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 my-2">
          <li className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-accent mt-1 shrink-0" />
            <div>
              <Link to="/trade/showroom" onClick={dismiss} className="font-body text-sm text-foreground hover:underline">Browse the Showroom</Link>
              <p className="font-body text-xs text-muted-foreground">Explore curated pieces in situ.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <FileText className="h-4 w-4 text-accent mt-1 shrink-0" />
            <div>
              <Link to="/trade/quotes" onClick={dismiss} className="font-body text-sm text-foreground hover:underline">Build a Tearsheet or Quote</Link>
              <p className="font-body text-xs text-muted-foreground">Create branded documents for your clients.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Users className="h-4 w-4 text-accent mt-1 shrink-0" />
            <div>
              <Link to="/trade/designers" onClick={dismiss} className="font-body text-sm text-foreground hover:underline">Discover Designers & Ateliers</Link>
              <p className="font-body text-xs text-muted-foreground">274 designers across 32 ateliers.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-accent mt-1 shrink-0" />
            <div>
              <button
                onClick={() => {
                  dismiss();
                  setTimeout(() => {
                    const btn = document.querySelector<HTMLButtonElement>('[aria-label="Open AI Concierge"]');
                    btn?.click();
                  }, 200);
                }}
                className="font-body text-sm text-foreground hover:underline text-left"
              >
                Meet your AI Concierge
              </button>
              <p className="font-body text-xs text-muted-foreground">Ask anything — sourcing, briefs, comparisons.</p>
            </div>
          </li>
        </ul>

        <DialogFooter>
          <Button onClick={dismiss} className="w-full sm:w-auto">Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
