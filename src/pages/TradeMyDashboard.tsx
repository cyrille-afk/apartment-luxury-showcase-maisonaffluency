import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Heart, ArrowRight, FolderArchive, MapPin, Sparkles, Eye, Lock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { FavoriteFoldersGrid } from "@/components/trade/FavoriteFoldersGrid";
import { FfeUnlockTile } from "@/components/trade/FfeUnlockTile";
import { useTradeCredits } from "@/hooks/useTradeCredits";
import { useToast } from "@/hooks/use-toast";

interface FavPreview {
  favoriteId: string;
  productId: string;
  product_name: string;
  image_url: string | null;
}

interface ImpersonatedUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export default function TradeMyDashboard() {
  const { user, profile, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const asUserId = searchParams.get("as");
  const isImpersonating = isAdmin && !!asUserId && asUserId !== user?.id;
  const effectiveUserId = isImpersonating ? asUserId! : user?.id;
  const [restrictedDismissed, setRestrictedDismissed] = useState(false);
  const showRestricted = searchParams.get("restricted") === "1" && !isImpersonating && !restrictedDismissed;

  const [favs, setFavs] = useState<FavPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [impersonated, setImpersonated] = useState<ImpersonatedUser | null>(null);
  const { availableCents } = useTradeCredits(isImpersonating ? asUserId! : undefined);
  const { toast } = useToast();

  useEffect(() => {
    const ffe = searchParams.get("ffe");
    if (ffe === "success") {
      toast({ title: "Payment received", description: "Your FF&E unlock is being activated. Refresh in a moment if not visible yet." });
      searchParams.delete("ffe");
      setSearchParams(searchParams, { replace: true });
    } else if (ffe === "cancelled") {
      toast({ title: "Checkout cancelled" });
      searchParams.delete("ffe");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  useEffect(() => {
    if (!effectiveUserId) return;
    const load = async () => {
      const { data } = await supabase
        .from("trade_favorites")
        .select("id, product_id, trade_products(product_name, image_url)")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false })
        .limit(8);
      setFavs((data || []).map((d: any) => ({
        favoriteId: d.id,
        productId: d.product_id,
        product_name: d.trade_products?.product_name || "Unknown",
        image_url: d.trade_products?.image_url || null,
      })));
      setLoading(false);
    };
    load();
  }, [effectiveUserId]);

  useEffect(() => {
    if (!isImpersonating) { setImpersonated(null); return; }
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("id", asUserId!)
      .maybeSingle()
      .then(({ data }) => setImpersonated(data as ImpersonatedUser | null));
  }, [isImpersonating, asUserId]);

  return (
    <>
      <Helmet><title>{isImpersonating ? "Viewing user dashboard" : "My Dashboard"} — Maison Affluency</title></Helmet>
      <div className="container max-w-7xl mx-auto px-4 py-8">
        {isImpersonating && (
          <div className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <div className="flex items-center gap-2 min-w-0">
              <Eye className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0" />
              <p className="font-body text-xs text-amber-900 dark:text-amber-100 truncate">
                Admin view — read-only dashboard for{" "}
                <span className="font-medium">
                  {impersonated
                    ? `${impersonated.first_name || ""} ${impersonated.last_name || ""}`.trim() || impersonated.email || asUserId
                    : asUserId}
                </span>
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="h-7 text-xs shrink-0">
              <Link to="/trade/admin/registered-users">Back to users</Link>
            </Button>
          </div>
        )}
        <header className="mb-8">
          <h1 className="font-display text-3xl text-foreground">
            {isImpersonating
              ? `${impersonated?.first_name || ""} ${impersonated?.last_name || ""}`.trim() || impersonated?.email || "User dashboard"
              : `Welcome${profile?.first_name ? `, ${profile.first_name}` : ""}`}
          </h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            {isImpersonating
              ? "Read-only snapshot of this user's favorites, folders and tools."
              : "Your favorites, folders and tools — all in one place."}
          </p>
          {availableCents > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--gold))]/10 border border-[hsl(var(--gold))]/30">
              <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--gold))]" />
              <span className="font-body text-xs text-foreground">
                ${(availableCents / 100).toLocaleString()} credit available{isImpersonating ? "" : " — applied automatically to your next quote"}
              </span>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2 space-y-8">
            {/* Favorites preview */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg text-foreground flex items-center gap-2">
                  <Heart className="h-4 w-4" /> Recent favorites
                </h2>
                <Link to="/trade/favorites" className="font-body text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  See all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {loading ? (
                <div className="text-xs text-muted-foreground">Loading…</div>
              ) : favs.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-8 text-center">
                  <Heart className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="font-body text-sm text-muted-foreground mb-3">No favorites yet</p>
                  <Button asChild size="sm" variant="outline"><Link to="/trade/designers">Browse designers</Link></Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {favs.map((f) => (
                    <Link key={f.favoriteId} to={`/trade/products/${f.productId}`}
                      className="block border border-border rounded-md overflow-hidden hover:border-foreground/30 transition-colors">
                      <div className="aspect-square bg-muted/30">
                        {f.image_url
                          ? <img src={f.image_url} alt={f.product_name} className="w-full h-full object-cover" loading="lazy" />
                          : <div className="w-full h-full flex items-center justify-center"><Heart className="h-4 w-4 text-muted-foreground/30" /></div>}
                      </div>
                      <p className="px-1.5 py-1 font-body text-[10px] text-foreground truncate">{f.product_name}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Folders */}
            <section>
              <FavoriteFoldersGrid userId={isImpersonating ? asUserId! : undefined} readOnly={isImpersonating} />
            </section>
          </div>

          {/* Right rail */}
          <div className="space-y-6">
            <FfeUnlockTile userId={isImpersonating ? asUserId! : undefined} readOnly={isImpersonating} />

            <Link to="/trade/showroom" className="block border border-border rounded-lg p-5 hover:border-foreground/30 transition-colors group">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-md bg-foreground/5 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-base text-foreground">Studios Showroom</h3>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">Explore featured ateliers and studios</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </Link>

            <Link to="/trade/boards" className="block border border-border rounded-lg p-5 hover:border-foreground/30 transition-colors group">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-md bg-foreground/5 flex items-center justify-center">
                  <FolderArchive className="h-5 w-5 text-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-base text-foreground">Project Folders</h3>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">Curate boards to share with clients</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
