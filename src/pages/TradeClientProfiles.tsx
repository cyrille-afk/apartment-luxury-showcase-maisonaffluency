import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Sparkles, User, Heart, FileText, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TasteProfile {
  id: string;
  user_id: string;
  cluster_label: string;
  cluster_description: string;
  top_designers: string[];
  top_brands: string[];
  top_categories: string[];
  top_materials: string[];
  style_keywords: string[];
  engagement_score: number;
  total_favorites: number;
  total_quotes: number;
  total_samples: number;
  computed_at: string;
}

interface ProfileWithUser extends TasteProfile {
  profile?: { first_name: string; last_name: string; company: string; email: string };
}

const CLUSTER_COLORS: Record<string, string> = {
  "Brutalist Minimalist": "bg-stone-100 text-stone-800 border-stone-300",
  "Art Deco Maximalist": "bg-amber-50 text-amber-800 border-amber-300",
  "Organic Modernist": "bg-emerald-50 text-emerald-800 border-emerald-300",
  "French Heritage Collector": "bg-blue-50 text-blue-800 border-blue-300",
  "Material Sensualist": "bg-rose-50 text-rose-800 border-rose-300",
  "New Client": "bg-muted text-muted-foreground border-border",
};

const getClusterColor = (label: string) => {
  return CLUSTER_COLORS[label] || "bg-primary/5 text-primary border-primary/20";
};

const TradeClientProfiles = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ProfileWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data: tasteProfiles, error } = await supabase
      .from("client_taste_profiles")
      .select("*")
      .order("engagement_score", { ascending: false });

    if (error) {
      console.error("Error fetching taste profiles:", error);
      setLoading(false);
      return;
    }

    // Fetch user profiles
    const userIds = (tasteProfiles || []).map((p: any) => p.user_id);
    const { data: userProfiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, company, email")
      .in("id", userIds);

    const profileMap = new Map((userProfiles || []).map((p: any) => [p.id, p]));

    const enriched = (tasteProfiles || []).map((tp: any) => ({
      ...tp,
      profile: profileMap.get(tp.user_id),
    }));

    setProfiles(enriched);
    setLoading(false);
  };

  const computeProfiles = async () => {
    setComputing(true);
    try {
      const { data, error } = await supabase.functions.invoke("compute-taste-profiles");
      if (error) throw error;
      toast({
        title: "Profiles computed",
        description: `Processed ${data?.processed || 0} client profiles.`,
      });
      await fetchProfiles();
    } catch (err) {
      console.error("Error computing profiles:", err);
      toast({
        title: "Error",
        description: "Failed to compute taste profiles. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setComputing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchProfiles();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const activeProfiles = profiles.filter(p => p.cluster_label !== "New Client");
  const newClients = profiles.filter(p => p.cluster_label === "New Client");

  // Group by cluster label
  const clusters = new Map<string, ProfileWithUser[]>();
  for (const p of activeProfiles) {
    const arr = clusters.get(p.cluster_label) || [];
    arr.push(p);
    clusters.set(p.cluster_label, arr);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light tracking-wide text-foreground">Client Taste Profiles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered behavioural clustering from favorites, quotes &amp; sample requests
          </p>
        </div>
        <Button
          onClick={computeProfiles}
          disabled={computing}
          className="gap-2"
        >
          {computing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {computing ? "Analysing…" : "Recompute Profiles"}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Sparkles className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">No taste profiles computed yet.</p>
            <Button onClick={computeProfiles} disabled={computing} variant="outline" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Run First Analysis
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-semibold text-foreground">{profiles.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Total Profiled</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-semibold text-foreground">{clusters.size}</div>
                <div className="text-xs text-muted-foreground mt-1">Taste Clusters</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-semibold text-foreground">{activeProfiles.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Active Profiles</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-semibold text-foreground">{newClients.length}</div>
                <div className="text-xs text-muted-foreground mt-1">New / Low Data</div>
              </CardContent>
            </Card>
          </div>

          {/* Cluster groups */}
          {Array.from(clusters.entries()).map(([label, members]) => (
            <div key={label} className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`text-sm px-3 py-1 ${getClusterColor(label)}`}>
                  {label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {members.length} client{members.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {members.map(p => (
                  <Card key={p.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base font-medium">
                            {p.profile?.first_name} {p.profile?.last_name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">{p.profile?.company}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{p.total_favorites}</span>
                          <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{p.total_quotes}</span>
                          <span className="flex items-center gap-1"><Package className="h-3 w-3" />{p.total_samples}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {p.cluster_description}
                      </p>

                      {p.style_keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {p.style_keywords.map(kw => (
                            <Badge key={kw} variant="secondary" className="text-[10px] px-2 py-0.5 font-normal">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {p.top_brands.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Top Brands</p>
                          <p className="text-xs text-foreground">{p.top_brands.join(" · ")}</p>
                        </div>
                      )}

                      {p.top_designers.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Aligned Designers</p>
                          <p className="text-xs text-foreground">{p.top_designers.join(" · ")}</p>
                        </div>
                      )}

                      <p className="text-[10px] text-muted-foreground/60 pt-1">
                        Last computed {new Date(p.computed_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {/* New clients section */}
          {newClients.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                New Clients (Insufficient Data)
              </h3>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                {newClients.map(p => (
                  <Card key={p.id} className="bg-muted/30">
                    <CardContent className="py-3 px-4">
                      <p className="text-sm font-medium text-foreground">
                        {p.profile?.first_name} {p.profile?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.profile?.company}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {p.total_favorites} favs · {p.total_quotes} quotes · {p.total_samples} samples
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TradeClientProfiles;
