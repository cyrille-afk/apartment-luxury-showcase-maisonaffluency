import { useState, useEffect, useCallback, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, X, Trash2, GripVertical, Pencil, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface Hotspot {
  id: string;
  x_percent: number;
  y_percent: number;
  product_name: string;
  designer_name: string | null;
  product_image_url: string | null;
  link_url: string | null;
}

interface GalleryHotspotsProps {
  imageIdentifier: string;
  visible: boolean;
  onCloseLightbox?: () => void;
}

interface PendingHotspot {
  x_percent: number;
  y_percent: number;
}

const GalleryHotspots = ({ imageIdentifier, visible, onCloseLightbox }: GalleryHotspotsProps) => {
  const isMobile = useIsMobile();
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [pending, setPending] = useState<PendingHotspot | null>(null);
  const [formData, setFormData] = useState({ product_name: "", designer_name: "", product_image_url: "", link_url: "" });
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const didDragRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const DRAG_THRESHOLD = 5; // pixels
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ product_name: "", designer_name: "", product_image_url: "", link_url: "" });

  useEffect(() => {
    if (!imageIdentifier) return;
    // Clear old hotspots immediately to avoid showing stale markers on new image
    setHotspots([]);
    setActiveId(null);
    const fetchHotspots = async () => {
      const { data } = await supabase
        .from("gallery_hotspots")
        .select("*")
        .eq("image_identifier", imageIdentifier);
      if (data) setHotspots(data);
    };
    fetchHotspots();
  }, [imageIdentifier]);

  // Toggle edit mode with Ctrl+Shift+H
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "H") {
        e.preventDefault();
        setEditMode(prev => !prev);
        setPending(null);
        setActiveId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!editMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPending({ x_percent: Math.round(x * 10) / 10, y_percent: Math.round(y * 10) / 10 });
    setFormData({ product_name: "", designer_name: "", product_image_url: "", link_url: "" });
  }, [editMode]);

  const savePending = async () => {
    if (!pending || !formData.product_name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("gallery_hotspots")
      .insert({
        image_identifier: imageIdentifier,
        x_percent: pending.x_percent,
        y_percent: pending.y_percent,
        product_name: formData.product_name.trim(),
        designer_name: formData.designer_name.trim() || null,
        product_image_url: formData.product_image_url.trim() || null,
        link_url: formData.link_url.trim() || null,
      })
      .select()
      .single();
    if (data) {
      setHotspots(prev => [...prev, data]);
      setPending(null);
    }
    setSaving(false);
  };

  const deleteHotspot = async (id: string) => {
    await supabase.from("gallery_hotspots").delete().eq("id", id);
    setHotspots(prev => prev.filter(h => h.id !== id));
    setActiveId(null);
  };

  const startEditing = (hotspot: Hotspot) => {
    setEditingId(hotspot.id);
    setEditData({
      product_name: hotspot.product_name,
      designer_name: hotspot.designer_name || "",
      product_image_url: hotspot.product_image_url || "",
      link_url: hotspot.link_url || "",
    });
  };

  const saveEdit = async () => {
    if (!editingId || !editData.product_name.trim()) return;
    setSaving(true);
    const updates = {
      product_name: editData.product_name.trim(),
      designer_name: editData.designer_name.trim() || null,
      product_image_url: editData.product_image_url.trim() || null,
      link_url: editData.link_url.trim() || null,
    };
    await supabase.from("gallery_hotspots").update(updates).eq("id", editingId);
    setHotspots(prev => prev.map(h => h.id === editingId ? { ...h, ...updates } : h));
    setEditingId(null);
    setSaving(false);
  };

  const handleDragMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingId || !editMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    // Only mark as drag if mouse moved beyond threshold
    if (!didDragRef.current && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
      didDragRef.current = true;
    }
    setHotspots(prev => prev.map(h => h.id === draggingId ? { ...h, x_percent: Math.round(x * 10) / 10, y_percent: Math.round(y * 10) / 10 } : h));
  }, [draggingId, editMode]);

  const handleDragEnd = useCallback(async () => {
    if (!draggingId) return;
    const hotspot = hotspots.find(h => h.id === draggingId);
    if (hotspot) {
      await supabase.from("gallery_hotspots").update({ x_percent: hotspot.x_percent, y_percent: hotspot.y_percent }).eq("id", draggingId);
    }
    setDraggingId(null);
  }, [draggingId, hotspots]);

  if (!visible) return null;

  return (
    <div
      className={`absolute inset-0 z-30 ${editMode ? "cursor-crosshair" : "pointer-events-none"}`}
      onClick={handleImageClick}
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      {/* Edit mode indicator */}
      {editMode && (
        <div className="absolute top-2 left-2 z-50 bg-amber-500 text-black text-xs font-bold px-2.5 py-1 rounded-full pointer-events-none select-none">
          EDIT MODE — Click to place · Ctrl+Shift+H to exit
        </div>
      )}

      {/* Existing hotspots */}
      {hotspots.map((hotspot) => (
        <div
          key={hotspot.id}
          className={`absolute pointer-events-auto transition-opacity duration-200 ${activeId && activeId !== hotspot.id ? "opacity-0 pointer-events-none" : "opacity-100"}`}
          style={{
            left: `${hotspot.x_percent}%`,
            top: `${hotspot.y_percent}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Marker */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              // In edit mode, only toggle popup if we didn't drag
              if (editMode) return; // handled by onMouseUp
              setActiveId(activeId === hotspot.id ? null : hotspot.id);
            }}
            onMouseDown={(e) => {
              if (editMode) {
                e.stopPropagation();
                e.preventDefault();
                didDragRef.current = false;
                dragStartRef.current = { x: e.clientX, y: e.clientY };
                setDraggingId(hotspot.id);
              }
            }}
            onMouseUp={(e) => {
              if (editMode && draggingId === hotspot.id && !didDragRef.current) {
                e.stopPropagation();
                setDraggingId(null);
                setActiveId(activeId === hotspot.id ? null : hotspot.id);
              }
            }}
            className={`relative w-5 h-5 rounded-full bg-white/90 backdrop-blur-sm border border-black/10 flex items-center justify-center text-black hover:bg-white hover:scale-110 transition-all duration-200 shadow-lg ${editMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
            aria-label={`View details for ${hotspot.product_name}`}
          >
            <AnimatePresence mode="wait">
              {activeId === hotspot.id ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <X className="w-2.5 h-2.5" />
                </motion.div>
              ) : (
                <motion.div key="plus" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Plus className="w-2.5 h-2.5" />
                </motion.div>
              )}
            </AnimatePresence>
            {activeId !== hotspot.id && !editMode && (
              <span className="absolute inset-0 rounded-full border border-black/20 animate-ping" style={{ animationDuration: "2s" }} />
            )}
          </button>

          {/* Popup card */}
          <AnimatePresence>
            {activeId === hotspot.id && (
              <motion.div
                initial={{ opacity: 0, y: isMobile ? (hotspot.y_percent > 50 ? 8 : -8) : 0, x: !isMobile ? (hotspot.x_percent > 65 ? 8 : -8) : 0, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: isMobile ? (hotspot.y_percent > 50 ? 8 : -8) : 0, x: !isMobile ? (hotspot.x_percent > 65 ? 8 : -8) : 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`absolute z-40 ${
                  isMobile
                    ? `min-w-[180px] max-w-[220px] ${hotspot.y_percent > 45 ? "bottom-full mb-2" : "top-full mt-2"} ${hotspot.x_percent > 55 ? "right-0" : hotspot.x_percent < 35 ? "left-0" : "left-1/2 -translate-x-1/2"}`
                    : `min-w-[200px] max-w-[260px] ${hotspot.x_percent > 65 ? "right-full mr-2" : "left-full ml-2"} ${hotspot.y_percent > 65 ? "bottom-0" : hotspot.y_percent < 35 ? "top-0" : "top-1/2 -translate-y-1/2"}`
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-lg shadow-2xl border border-primary/10 overflow-hidden">
                  {editMode && editingId === hotspot.id ? (
                    /* Inline edit form */
                    <div className="p-3 w-[260px]">
                      <h5 className="font-serif text-sm text-foreground mb-2">Edit Hotspot</h5>
                      <div className="space-y-2">
                        <input type="text" placeholder="Product name *" value={editData.product_name} onChange={e => setEditData(d => ({ ...d, product_name: e.target.value }))} className="w-full text-xs border border-primary/20 rounded px-2 py-1.5 font-body focus:outline-none focus:ring-1 focus:ring-primary/30" autoFocus />
                        <input type="text" placeholder="Designer name" value={editData.designer_name} onChange={e => setEditData(d => ({ ...d, designer_name: e.target.value }))} className="w-full text-xs border border-primary/20 rounded px-2 py-1.5 font-body focus:outline-none focus:ring-1 focus:ring-primary/30" />
                        <input type="text" placeholder="Product image URL" value={editData.product_image_url} onChange={e => setEditData(d => ({ ...d, product_image_url: e.target.value }))} className="w-full text-xs border border-primary/20 rounded px-2 py-1.5 font-body focus:outline-none focus:ring-1 focus:ring-primary/30" />
                        <input type="text" placeholder="Link URL" value={editData.link_url} onChange={e => setEditData(d => ({ ...d, link_url: e.target.value }))} className="w-full text-xs border border-primary/20 rounded px-2 py-1.5 font-body focus:outline-none focus:ring-1 focus:ring-primary/30" />
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={saveEdit} disabled={!editData.product_name.trim() || saving} className="flex-1 flex items-center justify-center gap-1 text-xs font-body bg-primary text-primary-foreground rounded px-3 py-1.5 hover:bg-primary/90 disabled:opacity-50 transition-colors">
                          <Check className="w-3 h-3" /> {saving ? "Saving..." : "Save"}
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-xs font-body text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    /* Normal display */
                    <>
                      {hotspot.product_image_url && (
                        <div className="w-full h-32 overflow-hidden bg-muted/10">
                          <img src={hotspot.product_image_url} alt={hotspot.product_name} className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div className="p-3">
                        <h5 className="font-serif text-sm text-foreground leading-tight">{hotspot.product_name}</h5>
                        {hotspot.designer_name && (
                          <p className="text-xs text-muted-foreground font-body mt-0.5">{hotspot.designer_name}</p>
                        )}
                        {hotspot.link_url && (
                          <button
                            className="inline-block mt-2 text-xs text-primary underline underline-offset-2 font-body hover:text-primary/80 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              const url = hotspot.link_url!;
                              if (url.match(/^#\/?curators\//) || url.startsWith('/#curators/')) {
                                // Normalize to #curators/... format
                                let hash = url;
                                if (url.startsWith('/#')) hash = url.slice(1);
                                if (hash.startsWith('#/curators/')) hash = '#curators/' + hash.slice('#/curators/'.length);
                                window.dispatchEvent(new CustomEvent('open-curators-pick', { detail: hash }));
                              } else {
                                window.location.href = url;
                              }
                            }}
                          >
                            View details →
                          </button>
                        )}
                        {editMode && (
                          <div className="mt-2 flex items-center gap-3">
                            <button onClick={() => startEditing(hotspot)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button onClick={() => deleteHotspot(hotspot.id)} className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors">
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {/* Pending hotspot placement */}
      {pending && editMode && (
        <div
          className="absolute pointer-events-auto"
          style={{
            left: `${pending.x_percent}%`,
            top: `${pending.y_percent}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="w-5 h-5 rounded-full bg-amber-400 border-2 border-amber-600 flex items-center justify-center shadow-lg">
            <Plus className="w-2.5 h-2.5 text-amber-900" />
          </div>
          {/* Form */}
          <div
            className="absolute z-50 mt-2 left-1/2 -translate-x-1/2 w-[280px] bg-white rounded-lg shadow-2xl border border-primary/10 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h5 className="font-serif text-sm text-foreground mb-3">New Hotspot</h5>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Product name *"
                value={formData.product_name}
                onChange={e => setFormData(f => ({ ...f, product_name: e.target.value }))}
                className="w-full text-xs border border-primary/20 rounded px-2 py-1.5 font-body focus:outline-none focus:ring-1 focus:ring-primary/30"
                autoFocus
              />
              <input
                type="text"
                placeholder="Designer name"
                value={formData.designer_name}
                onChange={e => setFormData(f => ({ ...f, designer_name: e.target.value }))}
                className="w-full text-xs border border-primary/20 rounded px-2 py-1.5 font-body focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <input
                type="text"
                placeholder="Product image URL"
                value={formData.product_image_url}
                onChange={e => setFormData(f => ({ ...f, product_image_url: e.target.value }))}
                className="w-full text-xs border border-primary/20 rounded px-2 py-1.5 font-body focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <input
                type="text"
                placeholder="Link URL"
                value={formData.link_url}
                onChange={e => setFormData(f => ({ ...f, link_url: e.target.value }))}
                className="w-full text-xs border border-primary/20 rounded px-2 py-1.5 font-body focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={savePending}
                disabled={!formData.product_name.trim() || saving}
                className="flex-1 text-xs font-body bg-primary text-primary-foreground rounded px-3 py-1.5 hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setPending(null)}
                className="text-xs font-body text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GalleryHotspots;
