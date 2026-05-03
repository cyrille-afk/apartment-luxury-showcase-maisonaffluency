import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, MapPin, FileText, Users, ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type LastSection = { path: string; label: string } | null;

const readLastSection = (): LastSection => {
  try {
    const raw = localStorage.getItem("trade_last_section");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.path && parsed?.label) return parsed as LastSection;
  } catch {}
  return null;
};

export const WelcomeIntroDialog = () => {
  const { user, isTradeUser, isAdmin, isSuperAdmin, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const lastSection = useMemo(readLastSection, [open]);

  useEffect(() => {
    if (!user || checked) return;
    if (!isTradeUser && !isAdmin) return;
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
  }, [user, isTradeUser, isAdmin, checked]);

  const dismiss = async () => {
    setOpen(false);
    if (user) {
      await supabase.from("profiles").update({ has_seen_trade_intro: true }).eq("id", user.id);
    }
  };

  // Role-based heading & subtitle
  const firstName = profile?.first_name?.trim();
  const greeting = firstName ? `Welcome, ${firstName}` : "Welcome to Maison Affluency";

  let subtitle = "Your trade account is approved. Here's where to begin:";
  if (isSuperAdmin) {
    subtitle = "Super Admin access enabled — full editorial, catalog and member controls are available to you.";
  } else if (isAdmin) {
    subtitle = "Admin access enabled — manage applications, content and trade quotes from the sidebar.";
  } else if (lastSection) {
    subtitle = `Glad to have you back. Pick up where you left off in ${lastSection.label}, or explore something new:`;
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{greeting}</DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground">
            {subtitle}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 my-2">
          {lastSection && !isAdmin && (
            <li className="flex items-start gap-3">
              <ArrowRight className="h-4 w-4 text-accent mt-1 shrink-0" />
              <div>
                <Link to={lastSection.path} onClick={dismiss} className="font-body text-sm text-foreground hover:underline">
                  Continue in {lastSection.label}
                </Link>
                <p className="font-body text-xs text-muted-foreground">Resume your last visited section.</p>
              </div>
            </li>
          )}

          {(isAdmin || isSuperAdmin) && (
            <li className="flex items-start gap-3">
              <ShieldCheck className="h-4 w-4 text-accent mt-1 shrink-0" />
              <div>
                <Link to="/trade/admin-dashboard" onClick={dismiss} className="font-body text-sm text-foreground hover:underline">
                  Open Admin Dashboard
                </Link>
                <p className="font-body text-xs text-muted-foreground">Review applications, quotes and member activity.</p>
              </div>
            </li>
          )}

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
