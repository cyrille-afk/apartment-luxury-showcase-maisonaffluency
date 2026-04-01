import { useState, useRef } from "react";
import { Instagram, RefreshCw, Eye, EyeOff, Trash2, GripVertical } from "lucide-react";
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
  const dragItem = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

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
        .order("sort_order", { ascending: true });
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

  const toggleHidden = async (postId: string, currentlyHidden: boolean) => {
    const { error } = await supabase
      .from("designer_instagram_posts")
      .update({ hidden: !currentlyHidden })
      .eq("id", postId);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    refetch();
    queryClient.invalidateQueries({ queryKey: ["homepage-instagram-feed"] });
  };

  const deletePost = async (postId: string) => {
    if (!window.confirm("Permanently delete this post? This cannot be undone.")) return;
    const { error } = await supabase
      .from("designer_instagram_posts")
      .delete()
      .eq("id", postId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    refetch();
    queryClient.invalidateQueries({ queryKey: ["homepage-instagram-feed"] });
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDrop = async () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    const reordered = [...posts];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, removed);
    dragItem.current = null;
    dragOverItem.current = null;

    // Batch update sort_order
    const updates = reordered.map((post: any, i: number) => ({ id: post.id, sort_order: i }));
    try {
      for (const u of updates) {
        await supabase
          .from("designer_instagram_posts")
          .update({ sort_order: u.sort_order })
          .eq("id", u.id);
      }
      refetch();
      queryClient.invalidateQueries({ queryKey: ["homepage-instagram-feed"] });
      toast({ title: "Order updated" });
    } catch (err: any) {
      toast({ title: "Reorder failed", description: err.message, variant: "destructive" });
    }
  };

  const visibleCount = posts.filter((p: any) => !p.hidden).length;

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Instagram className="h-4 w-4 text-muted-foreground" />
          <div>
            <span className="font-display text-sm text-foreground">Homepage Instagram Feed</span>
            <p className="font-body text-[10px] text-muted-foreground">@myaffluency · top 6 visible posts shown on homepage</p>
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
            Manage posts ({visibleCount} visible)
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          {posts.length === 0 ? (
            <p className="font-body text-xs text-muted-foreground text-center py-4">No posts found.</p>
          ) : (
            <div className="grid grid-cols-6 gap-1.5">
              {posts.map((post: any, i: number) => {
                const isHidden = post.hidden;
                return (
                  <div
                    key={post.id}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragEnter={() => handleDragEnter(i)}
                    onDragEnd={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className={`relative aspect-square overflow-hidden rounded bg-muted group cursor-grab active:cursor-grabbing ${isHidden ? "opacity-40" : ""}`}
                  >
                    <img
                      src={post.image_url!}
                      alt={post.caption?.substring(0, 40) || `Post ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {/* Overlay controls */}
                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => toggleHidden(post.id, isHidden)}
                        title={isHidden ? "Show on homepage" : "Hide from homepage"}
                        className="p-1.5 rounded-full bg-background/90 hover:bg-background text-foreground transition-colors"
                      >
                        {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => deletePost(post.id)}
                        title="Delete post"
                        className="p-1.5 rounded-full bg-background/90 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {/* Status badge */}
                    <div className="absolute top-1 right-1">
                      {isHidden && (
                        <span className="bg-foreground/70 text-background text-[8px] font-body px-1 py-0.5 rounded uppercase tracking-wider">
                          Hidden
                        </span>
                      )}
                      {!isHidden && i < 6 && (
                        <span className="bg-primary/80 text-primary-foreground text-[8px] font-body px-1 py-0.5 rounded">
                          #{post.sort_order + 1}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
