import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Box, Plus, ExternalLink, Eye, Trash2, EyeOff } from "lucide-react";
import { format } from "date-fns";

const TradeAxonometricGallery = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const [addingToQuote, setAddingToQuote] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Published gallery items
  const { data: items } = useQuery({
    queryKey: ["axonometric-gallery"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("axonometric_gallery")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // User's unpublished drafts
  const { data: drafts } = useQuery({
    queryKey: ["axonometric-gallery-drafts", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("axonometric_gallery")
        .select("*")
        .eq("created_by", user!.id)
        .eq("is_published", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  // Get user's draft quote to attach renders
  const { data: draftQuote } = useQuery({
    queryKey: ["draft-quote", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_quotes")
        .select("id")
        .eq("user_id", user!.id)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  const attachToQuote = async (item: any) => {
    if (!user) return;
    setAddingToQuote(true);
    try {
      let quoteId = draftQuote?.id;
      if (!quoteId) {
        const { data: newQuote, error: qErr } = await supabase
          .from("trade_quotes")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        if (qErr) throw qErr;
        quoteId = newQuote.id;
      }
      const { error } = await supabase.rpc("add_gallery_product_to_quote", {
        _user_id: user.id,
        _quote_id: quoteId,
        _product_name: item.title || "Axonometric Render",
        _brand_name: "Axonometric Studio",
        _category: "Render",
        _image_url: item.image_url,
      });
      if (error) throw error;
      toast({ title: "Render attached to your quote" });
      setSelected(null);
    } catch (e: any) {
      toast({ title: "Failed to attach", description: e.message, variant: "destructive" });
    } finally {
      setAddingToQuote(false);
    }
  };

  const publishDraft = async (item: any) => {
    setActionLoading(item.id);
    try {
      const { error } = await (supabase as any)
        .from("axonometric_gallery")
        .update({ is_published: true })
        .eq("id", item.id);
      if (error) throw error;
      toast({ title: "Render published to gallery" });
      queryClient.invalidateQueries({ queryKey: ["axonometric-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["axonometric-gallery-drafts"] });
      if (selected?.id === item.id) setSelected(null);
    } catch (e: any) {
      toast({ title: "Publish failed", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const deleteDraft = async (item: any) => {
    setActionLoading(item.id);
    try {
      const { error } = await (supabase as any)
        .from("axonometric_gallery")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
      toast({ title: "Draft deleted" });
      queryClient.invalidateQueries({ queryKey: ["axonometric-gallery-drafts"] });
      if (selected?.id === item.id) setSelected(null);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const renderCard = (item: any, isDraft = false) => (
    <button
      key={item.id}
      onClick={() => setSelected({ ...item, _isDraft: isDraft })}
      className="group border border-border rounded-lg overflow-hidden text-left hover:border-foreground/20 transition-colors relative"
    >
      {isDraft && (
        <span className="absolute top-2 left-2 z-10 font-body text-[10px] px-1.5 py-0.5 rounded bg-foreground/80 text-background">
          Draft
        </span>
      )}
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={item.image_url}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-3 space-y-1">
        <p className="font-display text-sm text-foreground line-clamp-1">{item.title || "Untitled"}</p>
        {item.project_name && (
          <p className="font-body text-[10px] text-muted-foreground">{item.project_name}</p>
        )}
        <div className="flex items-center gap-2">
          {item.style_preset && (
            <span className="font-body text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {item.style_preset}
            </span>
          )}
          <span className="font-body text-[10px] text-muted-foreground ml-auto">
            {format(new Date(item.created_at), "d MMM yyyy")}
          </span>
        </div>
      </div>
    </button>
  );

  return (
    <>
      <Helmet>
        <title>3D Studio Gallery | Trade Portal</title>
      </Helmet>

      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-2xl text-foreground">3D Studio Gallery</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Browse axonometric renders created by our team — attach any to your quotes
          </p>
        </div>

        {/* My Drafts Section */}
        {drafts && drafts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-display text-base text-foreground">My Drafts</h2>
              <span className="font-body text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {drafts.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {drafts.map((item: any) => renderCard(item, true))}
            </div>
          </div>
        )}

        {/* Published Gallery */}
        {items && items.length === 0 && (!drafts || drafts.length === 0) && (
          <div className="border border-dashed border-border rounded-lg py-16 flex flex-col items-center justify-center gap-3">
            <Box className="w-8 h-8 text-muted-foreground/40" />
            <p className="font-body text-sm text-muted-foreground">No renders available yet</p>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="space-y-3">
            {drafts && drafts.length > 0 && (
              <h2 className="font-display text-base text-foreground">Published</h2>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item: any) => renderCard(item))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {selected?.title || "Render"}
              {selected?._isDraft && (
                <span className="ml-2 font-body text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground align-middle">
                  Draft
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <img
                src={selected.image_url}
                alt={selected.title}
                className="w-full rounded-md border border-border"
              />
              {selected.description && (
                <p className="font-body text-sm text-muted-foreground">{selected.description}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {selected.style_preset && (
                  <span className="font-body text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    {selected.style_preset}
                  </span>
                )}
                {selected.project_name && (
                  <span className="font-body text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    {selected.project_name}
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {selected._isDraft ? (
                  <>
                    <Button
                      onClick={() => publishDraft(selected)}
                      disabled={actionLoading === selected.id}
                      className="flex-1"
                      size="sm"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                      {actionLoading === selected.id ? "Publishing…" : "Publish"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteDraft(selected)}
                      disabled={actionLoading === selected.id}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => attachToQuote(selected)}
                    disabled={addingToQuote}
                    className="flex-1"
                    size="sm"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    {addingToQuote ? "Adding…" : "Attach to Quote"}
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <a href={selected.image_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Full Size
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TradeAxonometricGallery;
