import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Layout, Construction, ChevronLeft } from "lucide-react";
import { useFfeEntitlement } from "@/hooks/useFfeEntitlement";
import { Button } from "@/components/ui/button";

export default function TradeFfeTool() {
  const { unlocked, loading } = useFfeEntitlement();

  if (loading) return <div className="container py-12 text-sm text-muted-foreground">Loading…</div>;

  if (!unlocked) {
    return (
      <div className="container max-w-2xl mx-auto py-16 text-center">
        <h1 className="font-display text-2xl text-foreground mb-3">Locked</h1>
        <p className="font-body text-sm text-muted-foreground mb-6">
          You need to unlock the Floor Plan → FF&E tool from your dashboard.
        </p>
        <Button asChild><Link to="/trade/me">Go to dashboard</Link></Button>
      </div>
    );
  }

  return (
    <>
      <Helmet><title>Floor Plan → FF&E — Maison Affluency</title></Helmet>
      <div className="container max-w-5xl mx-auto px-4 py-8">
        <Link to="/trade/me" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Dashboard
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-md bg-foreground/5 flex items-center justify-center">
            <Layout className="h-5 w-5 text-[hsl(var(--gold))]" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-foreground">Floor Plan → FF&E</h1>
            <p className="font-body text-xs text-muted-foreground">Unlock active — credit applied to your next quote.</p>
          </div>
        </div>

        <div className="border border-border rounded-lg p-12 text-center bg-muted/10">
          <Construction className="h-10 w-10 mx-auto text-muted-foreground/40 mb-4" />
          <h2 className="font-display text-lg text-foreground mb-2">Tool launching soon</h2>
          <p className="font-body text-sm text-muted-foreground max-w-md mx-auto">
            Your access is reserved. Upload your floor plan here to auto-place favorites at scale. We'll notify you when the editor opens.
          </p>
        </div>
      </div>
    </>
  );
}
