import { useState } from "react";
import { Instagram, RefreshCw, Eye } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

const BRAND_DESIGNER_ID = "fc97c782-b149-482e-b362-a9427088d211";

export default function InstagramFeedAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: posts = [], refetch } = useQuery({
    queryKey: ["admin-ig-preview", BRAND_DESIGNER_ID],
    enabled: previewOpen,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designer_instagram_posts")
        .select("*")
        .eq("designer_id", BRAND_DESIGNER_ID)
        .not("image_url", "is", null)
        .order("sort_order", { ascending: true })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-instagram", {
        body: { designerId: BRAND_DESIGNER_ID },
      });
      if (error) throw error;
      toast({
        title: "Instagram synced",
        description: `${data.inserted} new posts added, ${data.skipped} already existed.`,
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["homepage-instagram-feed"] });
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Instagram className="h-4 w-4 text-muted-foreground" />
          <div>
            <span className="font-display text-sm text-foreground">Homepage Instagram Feed</span>
            <p className="font-body text-[10px] text-muted-foreground">@myaffluency · synced posts shown at bottom of homepage</p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border hover:border-foreground/30 font-body text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Re-sync"}
        </button>
      </div>

      <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
        <CollapsibleTrigger className="flex items-center gap-1.5 group cursor-pointer">
          <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
          <Eye className="h-3 w-3 text-muted-foreground" />
          <span className="font-body text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
            Preview homepage grid
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          {posts.length === 0 ? (
            <p className="font-body text-xs text-muted-foreground text-center py-4">No posts found.</p>
          ) : (
            <div className="grid grid-cols-6 gap-1">
              {posts.map((post, i) => (
                <div key={post.id} className="relative aspect-square overflow-hidden rounded bg-muted group">
                  <img
                    src={post.image_url!}
                    alt={post.caption?.substring(0, 40) || `Post ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-foreground/70 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="font-body text-[9px] text-background truncate block">
                      #{post.sort_order}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
