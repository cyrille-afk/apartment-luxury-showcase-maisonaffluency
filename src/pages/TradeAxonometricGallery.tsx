import { useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Box, Plus, ExternalLink, Eye, Trash2, EyeOff, Sparkles } from "lucide-react";
import { format } from "date-fns";

const ENGINE_OPTIONS = [
  { value: "corona", label: "Corona Renderer", price: "€280 (S$410) / view", desc: "Warm natural GI — ideal for residential interiors" },
  { value: "vray", label: "V-Ray", price: "€320 (S$470) / view", desc: "Precision lighting with caustics — best for galleries & hospitality" },
] as const;

const TradeAxonometricGallery = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const [addingToQuote, setAddingToQuote] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [prodRenderItem, setProdRenderItem] = useState<any | null>(null);
  const [chosenEngine, setChosenEngine] = useState<string>("corona");
  const [submittingRender, setSubmittingRender] = useState(false);

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

  const requestProductionRender = useCallback(async () => {
    if (!user || !prodRenderItem) return;
    setSubmittingRender(true);
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
      const engineLabel = ENGINE_OPTIONS.find(e => e.value === chosenEngine)?.label || chosenEngine;
      const { error } = await supabase.rpc("add_gallery_product_to_quote", {
        _user_id: user.id,
        _quote_id: quoteId,
        _product_name: `Production Render — ${prodRenderItem.title || "Untitled"}`,
        _brand_name: "Axonometric Studio",
        _category: "Production Render",
        _image_url: prodRenderItem.image_url,
        _materials: `Engine: ${engineLabel}`,
      });
      if (error) throw error;
      toast({ title: "Production render requested", description: `${engineLabel} — added to your quote` });
      setProdRenderItem(null);
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["draft-quote"] });
    } catch (e: any) {
      toast({ title: "Request failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmittingRender(false);
    }
  }, [user, prodRenderItem, chosenEngine, draftQuote, toast, queryClient]);

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
                  <>
                    <Button
                      onClick={() => attachToQuote(selected)}
                      disabled={addingToQuote}
                      className="flex-1"
                      size="sm"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      {addingToQuote ? "Adding…" : "Attach to Quote"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setChosenEngine("corona");
                        setProdRenderItem(selected);
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />Production Render
                    </Button>
                  </>
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

      {/* Engine Picker Dialog */}
      <Dialog open={!!prodRenderItem} onOpenChange={() => setProdRenderItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Choose Render Engine</DialogTitle>
            <DialogDescription className="font-body text-xs text-muted-foreground">
              Select the engine for your production render of "{prodRenderItem?.title || "Untitled"}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            {ENGINE_OPTIONS.map((eng) => (
              <button
                key={eng.value}
                onClick={() => setChosenEngine(eng.value)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  chosenEngine === eng.value
                    ? "border-foreground bg-muted/60"
                    : "border-border hover:border-foreground/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm text-foreground">{eng.label}</span>
                  <span className="font-display text-sm text-foreground">{eng.price}</span>
                </div>
                <p className="font-body text-[10px] text-muted-foreground mt-0.5">{eng.desc}</p>
              </button>
            ))}
          </div>
          <Button
            onClick={requestProductionRender}
            disabled={submittingRender}
            className="w-full mt-2"
            size="sm"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            {submittingRender ? "Submitting…" : "Request Production Render"}
          </Button>
          <p className="font-body text-[9px] text-muted-foreground/60 text-center">
            Added to your quote as a line item. Rush (+50%) available on request.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TradeAxonometricGallery;
