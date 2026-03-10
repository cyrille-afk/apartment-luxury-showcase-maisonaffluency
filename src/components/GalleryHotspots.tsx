import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
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

const GalleryHotspots = ({ imageIdentifier, visible }: GalleryHotspotsProps) => {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

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

  if (!hotspots.length || !visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
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
          {/* Marker button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveId(activeId === hotspot.id ? null : hotspot.id);
            }}
            className="relative w-9 h-9 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/90 hover:scale-110 transition-all duration-200 shadow-lg cursor-pointer"
            aria-label={`View details for ${hotspot.product_name}`}
          >
            <AnimatePresence mode="wait">
              {activeId === hotspot.id ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="w-4 h-4" />
                </motion.div>
              ) : (
                <motion.div
                  key="plus"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Plus className="w-4 h-4" />
                </motion.div>
              )}
            </AnimatePresence>
            {/* Pulse ring */}
            {activeId !== hotspot.id && (
              <span className="absolute inset-0 rounded-full border border-white/30 animate-ping" style={{ animationDuration: "2s" }} />
            )}
          </button>

          {/* Product card popup */}
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
                    <div className="w-full h-32 overflow-hidden">
                      <img
                        src={hotspot.product_image_url}
                        alt={hotspot.product_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-3">
                    <h5 className="font-serif text-sm text-foreground leading-tight">
                      {hotspot.product_name}
                    </h5>
                    {hotspot.designer_name && (
                      <p className="text-xs text-muted-foreground font-body mt-0.5">
                        {hotspot.designer_name}
                      </p>
                    )}
                    {hotspot.link_url && (
                      <a
                        href={hotspot.link_url}
                        className="inline-block mt-2 text-xs text-primary underline underline-offset-2 font-body hover:text-primary/80 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View details →
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};

export default GalleryHotspots;
