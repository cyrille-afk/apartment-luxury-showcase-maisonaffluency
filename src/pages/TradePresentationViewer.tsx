import { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ChevronLeft, Download, Maximize2, Minimize2, MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";

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
      const userIds = [...new Set((data || []).map((c: any) => c.user_id))];
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
    await (supabase as any).from("presentation_comments").insert({
      presentation_id: id,
      slide_id: slide?.id || null,
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

  if (loading) return null;
  if (!user) return <Navigate to="/trade/login" replace />;

  const slide = slides[currentSlide];
  const slideComments = comments.filter(c => c.slide_id === slide?.id);
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
                  Slide {currentSlide + 1} of {slides.length}
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
              {slide?.image_url && (
                <a href={slide.image_url} download target="_blank" rel="noopener noreferrer" className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Download">
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
            <div className="flex flex-col items-center flex-1">
              {/* Main slide */}
              <div className={`relative w-full ${fullscreen ? "flex-1" : ""} flex items-center justify-center p-6`}>
                <img
                  src={slide?.image_url}
                  alt={slide?.title}
                  className={`max-w-full ${fullscreen ? "max-h-[calc(100vh-180px)]" : "max-h-[60vh]"} object-contain rounded-lg`}
                />
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

        {/* Comments Panel */}
        {showComments && (
          <div className="w-80 border-l border-border flex flex-col bg-background shrink-0">
            <div className="p-4 border-b border-border">
              <h3 className="font-display text-sm text-foreground">Comments</h3>
              <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                {slide ? `On slide ${currentSlide + 1}: ${slide.title || "Untitled"}` : "Select a slide"}
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
