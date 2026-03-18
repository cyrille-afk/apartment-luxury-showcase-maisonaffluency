import { useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ChevronLeft, Download, Maximize2, Minimize2 } from "lucide-react";

interface Slide {
  id: string;
  image_url: string;
  title: string;
  description: string | null;
  project_name: string | null;
  style_preset: string | null;
  sort_order: number;
}

const TradePresentationViewer = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    enabled: !!id,
  });

  const { data: slides = [] } = useQuery({
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
    enabled: !!id,
  });

  const toggleFullscreen = () => {
    if (!fullscreen) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setFullscreen(!fullscreen);
  };

  if (loading) return null;
  if (!user) return <Navigate to="/trade/login" replace />;

  const slide = slides[currentSlide];

  return (
    <>
      <Helmet><title>{presentation?.title || "Presentation"} — Maison Affluency</title></Helmet>
      <div ref={containerRef} className={`${fullscreen ? "fixed inset-0 z-50 bg-background" : "max-w-6xl"}`}>
        {/* Top bar */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            {!fullscreen && (
              <button onClick={() => navigate(isAdmin ? `/trade/presentations/${id}` : "/trade")} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="font-display text-lg text-foreground">{presentation?.title}</h1>
              <p className="font-body text-[10px] text-muted-foreground">
                {presentation?.client_name && `${presentation.client_name} · `}
                {presentation?.project_name && `${presentation.project_name} · `}
                Slide {currentSlide + 1} of {slides.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {slide?.image_url && (
              <a
                href={slide.image_url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Download slide image"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
            <button onClick={toggleFullscreen} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {slides.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-body text-sm text-muted-foreground">This presentation has no slides yet.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* Main slide */}
            <div className={`relative w-full ${fullscreen ? "flex-1" : ""} flex items-center justify-center p-6`}>
              <img
                src={slide?.image_url}
                alt={slide?.title}
                className={`max-w-full ${fullscreen ? "max-h-[calc(100vh-180px)]" : "max-h-[60vh]"} object-contain rounded-lg`}
              />
              {/* Nav arrows */}
              <button
                onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                disabled={currentSlide === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-background/80 border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
                disabled={currentSlide >= slides.length - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-background/80 border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Slide info */}
            {slide && (slide.title || slide.description) && (
              <div className="text-center px-6 pb-4 max-w-2xl">
                {slide.title && <h2 className="font-display text-xl text-foreground mb-1">{slide.title}</h2>}
                {slide.description && <p className="font-body text-sm text-muted-foreground">{slide.description}</p>}
                <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground/60 font-body">
                  {slide.project_name && <span>Project: {slide.project_name}</span>}
                  {slide.style_preset && <span>Style: {slide.style_preset}</span>}
                </div>
              </div>
            )}

            {/* Thumbnail strip */}
            <div className="flex items-center gap-2 p-4 overflow-x-auto max-w-full border-t border-border">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentSlide(i)}
                  className={`shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                    i === currentSlide ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-foreground/30"
                  }`}
                >
                  <img src={s.image_url} alt={s.title} className="w-16 h-12 object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default TradePresentationViewer;
