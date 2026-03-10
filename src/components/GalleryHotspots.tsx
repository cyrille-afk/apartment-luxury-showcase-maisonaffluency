import { useState, useEffect, useCallback } from "react";
import { Plus, X, Trash2, GripVertical } from "lucide-react";
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
}

interface PendingHotspot {
  x_percent: number;
  y_percent: number;
}

const GalleryHotspots = ({ imageIdentifier, visible }: GalleryHotspotsProps) => {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [pending, setPending] = useState<PendingHotspot | null>(null);
  const [formData, setFormData] = useState({ product_name: "", designer_name: "", product_image_url: "", link_url: "" });
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    if (!imageIdentifier) return;
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

  const handleDragMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingId || !editMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
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
          className="absolute pointer-events-auto"
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
              if (!draggingId) setActiveId(activeId === hotspot.id ? null : hotspot.id);
            }}
            onMouseDown={(e) => {
              if (editMode) {
                e.stopPropagation();
                e.preventDefault();
                setDraggingId(hotspot.id);
              }
            }}
            className={`relative w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm border border-black/10 flex items-center justify-center text-black hover:bg-white hover:scale-110 transition-all duration-200 shadow-lg ${editMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
            aria-label={`View details for ${hotspot.product_name}`}
          >
            <AnimatePresence mode="wait">
              {activeId === hotspot.id ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <X className="w-3.5 h-3.5" />
                </motion.div>
              ) : (
                <motion.div key="plus" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Plus className="w-3.5 h-3.5" />
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
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute z-40 mt-2 left-1/2 -translate-x-1/2 min-w-[200px] max-w-[260px]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-lg shadow-2xl border border-primary/10 overflow-hidden">
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
                      <a href={hotspot.link_url} className="inline-block mt-2 text-xs text-primary underline underline-offset-2 font-body hover:text-primary/80 transition-colors" onClick={(e) => e.stopPropagation()}>
                        View details →
                      </a>
                    )}
                    {/* Delete button in edit mode */}
                    {editMode && (
                      <button
                        onClick={() => deleteHotspot(hotspot.id)}
                        className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    )}
                  </div>
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
          <div className="w-7 h-7 rounded-full bg-amber-400 border-2 border-amber-600 flex items-center justify-center shadow-lg">
            <Plus className="w-3.5 h-3.5 text-amber-900" />
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
