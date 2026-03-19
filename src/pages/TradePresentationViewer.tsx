import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ChevronLeft, Download, Maximize2, Minimize2, MessageSquare, Send, FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
// Lazy-loaded to avoid crash on module init
const loadPdfRenderer = () => import("@react-pdf/renderer");
const loadPresentationPDF = () => import("@/components/trade/PresentationPDF");

interface Slide {
  id: string;
  image_url: string;
  title: string;
  description: string | null;
  project_name: string | null;
  style_preset: string | null;
  sort_order: number;
}

interface Comment {
  id: string;
  slide_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

const TradePresentationViewer = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

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

  const { data: comments = [] } = useQuery({
    queryKey: ["presentation-comments", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("presentation_comments")
        .select("*")
        .eq("presentation_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      // Fetch user names
      const userIds = [...new Set((data || []).map((c: any) => c.user_id))] as string[];
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      return (data || []).map((c: any) => ({
        ...c,
        user_email: profileMap.get(c.user_id)?.email || "",
        user_name: profileMap.get(c.user_id) ? `${profileMap.get(c.user_id)!.first_name} ${profileMap.get(c.user_id)!.last_name}`.trim() : "Unknown",
      })) as Comment[];
    },
    enabled: !!id,
  });

  // Realtime comments subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`presentation-comments-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "presentation_comments", filter: `presentation_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["presentation-comments", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  // Auto-scroll comments
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;
    setSubmitting(true);
    const slide = slides[currentSlide];
    const currentActualSlide = currentSlide === 0 ? null : slides[currentSlide - 1];
    await (supabase as any).from("presentation_comments").insert({
      presentation_id: id,
      slide_id: currentActualSlide?.id || null,
      user_id: user.id,
      content: newComment.trim(),
    });
    setNewComment("");
    setSubmitting(false);
    queryClient.invalidateQueries({ queryKey: ["presentation-comments", id] });
  };

  const toggleFullscreen = () => {
    if (!fullscreen) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setFullscreen(!fullscreen);
  };

  const handleExportPdf = useCallback(async () => {
    if (!presentation || slides.length === 0) return;
    setExportingPdf(true);
    toast.info("Preparing PDF export…");
    try {
      // Convert all slide images to base64 to avoid CORS issues in @react-pdf/renderer
      const slidesWithDataUrls = await Promise.all(
        slides.map(async (slide) => {
          try {
            const res = await fetch(slide.image_url);
            const blob = await res.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            return { ...slide, image_url: dataUrl };
          } catch {
            // If fetch fails, keep original URL as fallback
            return slide;
          }
        })
      );

      const [{ pdf }, { default: PresentationPDF }] = await Promise.all([
        loadPdfRenderer(),
        loadPresentationPDF(),
      ]);
      const blob = await pdf(
        <PresentationPDF
          title={presentation.title || ""}
          clientName={presentation.client_name || undefined}
          projectName={presentation.project_name || undefined}
          createdAt={presentation.created_at || new Date().toISOString()}
          slides={slidesWithDataUrls}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(presentation.title || "Presentation").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded successfully");
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error("PDF export failed. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  }, [presentation, slides]);

  if (loading) return null;
  if (!user) return <Navigate to="/trade/login" replace />;

  // Slide 0 = cover page, then gallery slides start at index 1
  const totalSlides = slides.length + 1;
  const isCoverSlide = currentSlide === 0;
  const actualSlide = isCoverSlide ? null : slides[currentSlide - 1];
  const slideComments = comments.filter(c => actualSlide && c.slide_id === actualSlide.id);
  const generalComments = comments.filter(c => !c.slide_id);

  return (
    <>
      <Helmet><title>{presentation?.title || "Presentation"} — Maison Affluency</title></Helmet>
      <div ref={containerRef} className={`${fullscreen ? "fixed inset-0 z-50 bg-background" : "max-w-6xl"} flex`}>
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
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
                  Slide {currentSlide + 1} of {totalSlides}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowComments(!showComments)}
                className={`p-2 rounded-md transition-colors relative ${showComments ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                title="Comments"
              >
                <MessageSquare className="w-4 h-4" />
                {comments.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[9px] flex items-center justify-center font-body">
                    {comments.length}
                  </span>
                )}
              </button>
              {slides.length > 0 && (
                <button
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  title="Export as PDF"
                >
                  {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                </button>
              )}
              {actualSlide?.image_url && (
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(actualSlide.image_url);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${(actualSlide.title || "slide").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-")}.png`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      window.open(actualSlide.image_url, "_blank");
                    }
                  }}
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Download image"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              <button onClick={toggleFullscreen} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {slides.length === 0 && !isCoverSlide ? (
            <div className="text-center py-16">
              <p className="font-body text-sm text-muted-foreground">This presentation has no slides yet.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center flex-1">
              {/* Main slide area */}
              <div className={`relative w-full ${fullscreen ? "flex-1" : ""} flex items-center justify-center p-6`}>
                {isCoverSlide ? (
                  /* Cover Page */
                  <div className={`w-full ${fullscreen ? "max-h-[calc(100vh-180px)]" : "max-h-[60vh]"} aspect-[16/9] max-w-4xl bg-foreground rounded-lg flex flex-col items-center justify-center text-center px-12 relative overflow-hidden`}>
                    {/* Subtle border frame */}
                    <div className="absolute inset-4 border border-background/20 rounded-md pointer-events-none" />
                    <span className="font-body text-[10px] text-background/40 uppercase tracking-[0.35em] mb-6">Prepared by</span>
                    <h2 className="font-display text-4xl md:text-5xl text-background tracking-wide mb-2">Maison Affluency</h2>
                    <div className="w-16 h-px bg-background/30 my-6" />
                    {presentation?.title && (
                      <h3 className="font-display text-xl md:text-2xl text-background/90 mb-3">{presentation.title}</h3>
                    )}
                    {presentation?.client_name && (
                      <p className="font-body text-sm text-background/60 mb-1">For {presentation.client_name}</p>
                    )}
                    {presentation?.project_name && (
                      <p className="font-body text-sm text-background/60 mb-4">{presentation.project_name}</p>
                    )}
                    <p className="font-body text-xs text-background/40 mt-4">
                      {format(new Date(presentation?.created_at || new Date()), "MMMM yyyy")}
                    </p>
                  </div>
                ) : (
                  /* Gallery slide */
                  <img
                    src={actualSlide?.image_url}
                    alt={actualSlide?.title}
                    className={`max-w-full ${fullscreen ? "max-h-[calc(100vh-180px)]" : "max-h-[60vh]"} object-contain rounded-lg`}
                  />
                )}
                {/* Nav arrows */}
                <button
                  onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                  disabled={currentSlide === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-background/80 border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentSlide(Math.min(totalSlides - 1, currentSlide + 1))}
                  disabled={currentSlide >= totalSlides - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-background/80 border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              {/* Slide info (gallery slides only) */}
              {actualSlide && (actualSlide.title || actualSlide.description) && (
                <div className="text-center px-6 pb-4 max-w-2xl">
                  {actualSlide.title && <h2 className="font-display text-xl text-foreground mb-1">{actualSlide.title}</h2>}
                  {actualSlide.description && <p className="font-body text-sm text-muted-foreground">{actualSlide.description}</p>}
                  <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground/60 font-body">
                    {actualSlide.project_name && <span>Project: {actualSlide.project_name}</span>}
                    {actualSlide.style_preset && <span>Style: {actualSlide.style_preset}</span>}
                  </div>
                </div>
              )}

              {/* Thumbnail strip */}
              <div className="flex items-center gap-2 p-4 overflow-x-auto max-w-full border-t border-border">
                {/* Cover thumbnail */}
                <button
                  onClick={() => setCurrentSlide(0)}
                  className={`shrink-0 rounded-md overflow-hidden border-2 transition-all w-16 h-12 flex items-center justify-center ${
                    currentSlide === 0 ? "border-primary ring-2 ring-primary/20 bg-foreground" : "border-border hover:border-foreground/30 bg-foreground/80"
                  }`}
                >
                  <span className="font-display text-[8px] text-background tracking-wider">MA</span>
                </button>
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setCurrentSlide(i + 1)}
                    className={`shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                      i + 1 === currentSlide ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <img src={s.image_url} alt={s.title} className="w-16 h-12 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Comments Panel */}
        {showComments && (
          <div className="w-80 border-l border-border flex flex-col bg-background shrink-0">
            <div className="p-4 border-b border-border">
              <h3 className="font-display text-sm text-foreground">Comments</h3>
              <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                {isCoverSlide ? "Cover page" : actualSlide ? `On slide ${currentSlide}: ${actualSlide.title || "Untitled"}` : "Select a slide"}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {slideComments.length === 0 && generalComments.length === 0 && (
                <p className="font-body text-xs text-muted-foreground text-center py-8">No comments yet. Be the first to share your thoughts.</p>
              )}
              {slideComments.map((c) => (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-body text-xs font-medium text-foreground">{c.user_name || c.user_email}</span>
                    <span className="font-body text-[9px] text-muted-foreground">{format(new Date(c.created_at), "d MMM, HH:mm")}</span>
                  </div>
                  <p className="font-body text-sm text-foreground/80">{c.content}</p>
                </div>
              ))}
              {generalComments.length > 0 && slideComments.length > 0 && (
                <div className="border-t border-border pt-3 mt-3">
                  <p className="font-body text-[9px] text-muted-foreground uppercase tracking-wider mb-2">General</p>
                </div>
              )}
              {generalComments.map((c) => (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-body text-xs font-medium text-foreground">{c.user_name || c.user_email}</span>
                    <span className="font-body text-[9px] text-muted-foreground">{format(new Date(c.created_at), "d MMM, HH:mm")}</span>
                  </div>
                  <p className="font-body text-sm text-foreground/80">{c.content}</p>
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmitComment()}
                  placeholder="Add a comment…"
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submitting}
                  className="p-2 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-30"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default TradePresentationViewer;
