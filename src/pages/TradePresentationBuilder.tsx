import { useState, useCallback, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, GripVertical, Save, Eye, Check, Share2, X, UserPlus } from "lucide-react";

interface Slide {
  id: string;
  gallery_item_id: string | null;
  image_url: string;
  title: string;
  description: string | null;
  project_name: string | null;
  style_preset: string | null;
  sort_order: number;
}

interface GalleryItem {
  id: string;
  image_url: string;
  title: string;
  description: string | null;
  project_name: string | null;
  style_preset: string | null;
}

const inputClass =
  "w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors";

const TradePresentationBuilder = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<Set<string>>(new Set());

  // Fetch presentation
  const { data: presentation } = useQuery({
    queryKey: ["presentation", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("presentations")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!isAdmin,
  });

  // Fetch slides
  const { data: slides = [], refetch: refetchSlides } = useQuery({
    queryKey: ["presentation-slides", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("presentation_slides")
        .select("*")
        .eq("presentation_id", id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Slide[];
    },
    enabled: !!id && !!isAdmin,
  });

  // Fetch gallery items for the picker
  const { data: galleryItems = [] } = useQuery({
    queryKey: ["axonometric-gallery-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("axonometric_gallery")
        .select("id, image_url, title, description, project_name, style_preset")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as GalleryItem[];
    },
    enabled: !!isAdmin && showGalleryPicker,
  });

  // Sync form state when presentation loads
  useEffect(() => {
    if (presentation) {
      setTitle(presentation.title || "");
      setClientName(presentation.client_name || "");
      setProjectName(presentation.project_name || "");
      setDescription(presentation.description || "");
    }
  }, [presentation]);

  const handleSaveMeta = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("presentations")
      .update({ title, client_name: clientName, project_name: projectName, description, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Presentation saved" });
      queryClient.invalidateQueries({ queryKey: ["presentation", id] });
    }
  };

  const handleAddSlides = async () => {
    if (selectedGalleryIds.size === 0) return;
    const existingIds = new Set(slides.map(s => s.gallery_item_id));
    const toAdd = galleryItems.filter(g => selectedGalleryIds.has(g.id) && !existingIds.has(g.id));
    if (toAdd.length === 0) {
      toast({ title: "Selected items are already in the deck" });
      return;
    }

    const maxOrder = slides.length > 0 ? Math.max(...slides.map(s => s.sort_order)) : -1;
    const rows = toAdd.map((g, i) => ({
      presentation_id: id,
      gallery_item_id: g.id,
      image_url: g.image_url,
      title: g.title || "",
      description: g.description,
      project_name: g.project_name,
      style_preset: g.style_preset,
      sort_order: maxOrder + 1 + i,
    }));

    const { error } = await (supabase as any).from("presentation_slides").insert(rows);
    if (error) {
      toast({ title: "Error adding slides", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${toAdd.length} slide${toAdd.length > 1 ? "s" : ""} added` });
      setSelectedGalleryIds(new Set());
      setShowGalleryPicker(false);
      refetchSlides();
      // Update timestamp
      await (supabase as any).from("presentations").update({ updated_at: new Date().toISOString() }).eq("id", id);
    }
  };

  const handleRemoveSlide = async (slideId: string) => {
    await (supabase as any).from("presentation_slides").delete().eq("id", slideId);
    refetchSlides();
  };

  const handleReorder = useCallback(async (slideId: string, direction: "up" | "down") => {
    const idx = slides.findIndex(s => s.id === slideId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= slides.length) return;

    const a = slides[idx];
    const b = slides[swapIdx];
    await Promise.all([
      (supabase as any).from("presentation_slides").update({ sort_order: b.sort_order }).eq("id", a.id),
      (supabase as any).from("presentation_slides").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    refetchSlides();
  }, [slides, refetchSlides]);

  const handleUpdateSlide = useCallback(async (slideId: string, field: string, value: string) => {
    await (supabase as any).from("presentation_slides").update({ [field]: value || null }).eq("id", slideId);
    refetchSlides();
  }, [refetchSlides]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet><title>{title || "Presentation"} — Admin — Maison Affluency</title></Helmet>
      <div className="max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/trade/presentations")} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-2xl text-foreground">Edit Presentation</h1>
          </div>
          <button
            onClick={() => navigate(`/trade/presentations/${id}/view`)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-full font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
          <button
            onClick={handleSaveMeta}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div>
            <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Presentation title" />
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Client</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} placeholder="Client name" />
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Project</label>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className={inputClass} placeholder="Project name" />
          </div>
        </div>

        {/* Slides */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-foreground">Slides ({slides.length})</h2>
          <button
            onClick={() => setShowGalleryPicker(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-full font-body text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add from Gallery
          </button>
        </div>

        {slides.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <p className="font-body text-sm text-muted-foreground mb-4">No slides yet — add illustrations from the gallery</p>
            <button
              onClick={() => setShowGalleryPicker(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Slides
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {slides.map((slide, idx) => (
              <div key={slide.id} className="border border-border rounded-lg p-4 flex gap-4">
                <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                  <button onClick={() => handleReorder(slide.id, "up")} disabled={idx === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <span className="font-body text-[10px] text-muted-foreground">{idx + 1}</span>
                  <button onClick={() => handleReorder(slide.id, "down")} disabled={idx >= slides.length - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"><ArrowDown className="w-3.5 h-3.5" /></button>
                </div>
                <img src={slide.image_url} alt={slide.title} className="w-32 h-24 object-cover rounded-md bg-muted shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    value={slide.title}
                    onChange={(e) => handleUpdateSlide(slide.id, "title", e.target.value)}
                    className="w-full font-display text-sm text-foreground bg-transparent outline-none border-b border-transparent focus:border-border transition-colors"
                    placeholder="Slide title"
                  />
                  <input
                    value={slide.description || ""}
                    onChange={(e) => handleUpdateSlide(slide.id, "description", e.target.value)}
                    className="w-full font-body text-xs text-muted-foreground bg-transparent outline-none border-b border-transparent focus:border-border transition-colors"
                    placeholder="Description"
                  />
                  <div className="flex gap-4 text-[10px] text-muted-foreground/60 font-body">
                    {slide.project_name && <span>Project: {slide.project_name}</span>}
                    {slide.style_preset && <span>Style: {slide.style_preset}</span>}
                  </div>
                </div>
                <button onClick={() => handleRemoveSlide(slide.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0 self-start">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gallery Picker Modal */}
      {showGalleryPicker && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-display text-lg text-foreground">Select Illustrations</h3>
              <div className="flex items-center gap-3">
                <span className="font-body text-xs text-muted-foreground">{selectedGalleryIds.size} selected</span>
                <button
                  onClick={handleAddSlides}
                  disabled={selectedGalleryIds.size === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  Add Selected
                </button>
                <button onClick={() => { setShowGalleryPicker(false); setSelectedGalleryIds(new Set()); }} className="font-body text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-5">
              {galleryItems.length === 0 ? (
                <p className="text-center font-body text-sm text-muted-foreground py-8">
                  No gallery items found. Create some in the Axonometric Studio first.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {galleryItems.map((item) => {
                    const isSelected = selectedGalleryIds.has(item.id);
                    const alreadyAdded = slides.some(s => s.gallery_item_id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (alreadyAdded) return;
                          const next = new Set(selectedGalleryIds);
                          if (isSelected) next.delete(item.id); else next.add(item.id);
                          setSelectedGalleryIds(next);
                        }}
                        disabled={alreadyAdded}
                        className={`relative rounded-lg overflow-hidden border-2 transition-all text-left ${
                          alreadyAdded ? "opacity-40 cursor-not-allowed border-border" :
                          isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-foreground/30"
                        }`}
                      >
                        <img src={item.image_url} alt={item.title} className="w-full aspect-[4/3] object-cover" />
                        <div className="p-2">
                          <p className="font-display text-[11px] text-foreground truncate">{item.title || "Untitled"}</p>
                          {item.project_name && <p className="font-body text-[9px] text-muted-foreground truncate">{item.project_name}</p>}
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </div>
                        )}
                        {alreadyAdded && (
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-muted rounded font-body text-[8px] text-muted-foreground">Added</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TradePresentationBuilder;
