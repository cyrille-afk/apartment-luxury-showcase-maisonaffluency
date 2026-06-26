import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { collectibleDesigners } from "@/components/Collectibles";
import { invalidateCollectibleOverrides } from "@/hooks/useCollectibleOverrides";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Eye, EyeOff, ArrowLeft } from "lucide-react";

type Row = {
  slug: string;
  name: string;
  founder?: string;
  specialty: string;
  trade_only: boolean;
};

export default function TradeCollectiblesAdmin() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("collectible_overrides" as any)
        .select("slug, trade_only");
      const map: Record<string, boolean> = {};
      (data as any[] | null)?.forEach((r) => {
        map[String(r.slug)] = !!r.trade_only;
      });
      setOverrides(map);
      setLoaded(true);
    })();
  }, [isAdmin]);

  const rows: Row[] = useMemo(
    () =>
      collectibleDesigners
        .map((d) => ({
          slug: (d.id || d.name) as string,
          name: d.name,
          founder: d.founder,
          specialty: d.specialty,
          trade_only: !!overrides[(d.id || d.name) as string],
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })),
    [overrides]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.founder || "").toLowerCase().includes(q) ||
        r.specialty.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const tradeOnlyCount = rows.filter((r) => r.trade_only).length;

  const toggle = async (slug: string, next: boolean) => {
    setSaving((s) => ({ ...s, [slug]: true }));
    const prev = overrides[slug];
    setOverrides((o) => ({ ...o, [slug]: next }));
    const { error } = await supabase
      .from("collectible_overrides" as any)
      .upsert(
        { slug, trade_only: next, updated_by: (await supabase.auth.getUser()).data.user?.id },
        { onConflict: "slug" }
      );
    setSaving((s) => {
      const n = { ...s };
      delete n[slug];
      return n;
    });
    if (error) {
      setOverrides((o) => ({ ...o, [slug]: !!prev }));
      toast({
        title: "Could not update",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    invalidateCollectibleOverrides();
    toast({
      title: next ? "Now Trade Only" : "Visible to public",
      description: slug,
    });
  };

  if (loading) {
    return (
      <div className="p-8 text-sm text-muted-foreground font-body">
        Checking admin access…
      </div>
    );
  }
  if (!isAdmin) {
    if (import.meta.env.DEV) {
      return (
        <div className="p-8 max-w-xl space-y-3">
          <h1 className="font-display text-xl">Admin access required</h1>
          <p className="text-sm text-muted-foreground font-body">
            Sign in with an admin account to manage Collectible Design visibility.
          </p>
        </div>
      );
    }
    return <Navigate to="/trade" replace />;
  }

  return (
    <>
      <Helmet>
        <title>Collectible Design Editor — Trade Admin</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <Link
                to="/trade/designers/admin"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Designer Editor
              </Link>
            </div>
            <h1 className="font-display text-2xl tracking-wide mt-1">
              Collectible Design Editor
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-body">
              {rows.length} ateliers · {tradeOnlyCount} currently Trade Only ·
              Toggle to hide an atelier from the public site (it remains visible
              to signed-in trade members and admins).
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search ateliers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {!loaded ? (
          <div className="text-sm text-muted-foreground font-body">Loading overrides…</div>
        ) : (
          <div className="border rounded-md divide-y">
            {filtered.map((r) => (
              <div
                key={r.slug}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-sm tracking-wide truncate">
                      {r.name}
                    </span>
                    {r.founder && (
                      <span className="text-[11px] text-muted-foreground font-body">
                        · {r.founder}
                      </span>
                    )}
                    {r.trade_only ? (
                      <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                        Trade Only
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Public
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-body truncate">
                    {r.specialty}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">
                    {r.slug}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.trade_only ? (
                    <EyeOff className="h-4 w-4 text-amber-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                  <label className="flex items-center gap-2 text-xs font-body cursor-pointer">
                    Trade Only
                    <Switch
                      checked={r.trade_only}
                      disabled={!!saving[r.slug]}
                      onCheckedChange={(checked) => toggle(r.slug, checked)}
                    />
                  </label>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center font-body">
                No ateliers match "{search}".
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
