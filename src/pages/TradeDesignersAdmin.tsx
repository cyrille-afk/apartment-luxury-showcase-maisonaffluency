import { useState, useMemo, useCallback, Fragment, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Search, Save, ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff, Plus, Trash2, GripVertical, BookOpen, Monitor, Smartphone, AlertTriangle, Instagram } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { lazy, Suspense } from "react";
import CloudUpload from "@/components/trade/CloudUpload";

const EditorialBiography = lazy(() => import("@/components/EditorialBiography"));

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Inline heritage slide manager for each designer */
function HeritageSlideManager({ designerId }: { designerId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [slides, setSlides] = useState<{ id: string; image_url: string; caption: string | null; sort_order: number }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("designer_heritage_slides" as any)
      .select("*")
      .eq("designer_id", designerId)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setSlides((data as any[]) || []);
        setLoaded(true);
      });
  }, [designerId]);

  const handleUpload = async (urls: string[]) => {
    for (const url of urls) {
      const order = slides.length;
      const { data, error } = await (supabase.from("designer_heritage_slides" as any) as any)
        .insert({ designer_id: designerId, image_url: url, sort_order: order })
        .select()
        .single();
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      } else if (data) {
        setSlides((prev) => [...prev, data as any]);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["heritage-slides", designerId] });
  };

  const handleDelete = async (id: string) => {
    await (supabase.from("designer_heritage_slides" as any) as any).delete().eq("id", id);
    setSlides((prev) => prev.filter((s) => s.id !== id));
    queryClient.invalidateQueries({ queryKey: ["heritage-slides", designerId] });
  };

  const handleCaptionChange = async (id: string, caption: string) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, caption: caption || null } : s)));
    await (supabase.from("designer_heritage_slides" as any) as any).update({ caption: caption || null }).eq("id", id);
  };

  if (!loaded) return null;

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Heritage Slides <span className="normal-case font-normal">(5–7 historical photos shown as a slider between paragraphs)</span>
      </label>
      <div className="mt-2 space-y-2">
        {slides.map((slide) => (
          <div key={slide.id} className="flex items-start gap-2">
            <img src={slide.image_url} alt="" className="w-16 h-10 object-cover rounded shrink-0 bg-muted" />
            <Input
              value={slide.caption || ""}
              onChange={(e) => handleCaptionChange(slide.id, e.target.value)}
              placeholder="Caption (optional)"
              className="text-xs flex-1"
            />
            <button
              onClick={() => handleDelete(slide.id)}
              className="text-muted-foreground hover:text-destructive transition-colors p-1 mt-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <CloudUpload
          folder="heritage-slides"
          accept="image/*"
          multiple
          label="Upload heritage photos"
          onUpload={handleUpload}
        />
      </div>
    </div>
  );
}

/** Inline Instagram post manager for each designer */
function InstagramPostManager({ designerId }: { designerId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [posts, setPosts] = useState<{ id: string; post_url: string; caption: string | null; sort_order: number }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newUrl, setNewUrl] = useState("");

  useEffect(() => {
    supabase
      .from("designer_instagram_posts" as any)
      .select("*")
      .eq("designer_id", designerId)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setPosts((data as any[]) || []);
        setLoaded(true);
      });
  }, [designerId]);

  const handleAdd = async () => {
    const url = newUrl.trim();
    if (!url) return;
    const order = posts.length;
    const { data, error } = await (supabase.from("designer_instagram_posts" as any) as any)
      .insert({ designer_id: designerId, post_url: url, sort_order: order })
      .select()
      .single();
    if (error) {
      toast({ title: "Failed to add", description: error.message, variant: "destructive" });
    } else if (data) {
      setPosts((prev) => [...prev, data as any]);
      setNewUrl("");
      queryClient.invalidateQueries({ queryKey: ["designer-instagram-posts", designerId] });
    }
  };

  const handleDelete = async (id: string) => {
    await (supabase.from("designer_instagram_posts" as any) as any).delete().eq("id", id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
    queryClient.invalidateQueries({ queryKey: ["designer-instagram-posts", designerId] });
  };

  const handleCaptionChange = async (id: string, caption: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, caption: caption || null } : p)));
    await (supabase.from("designer_instagram_posts" as any) as any).update({ caption: caption || null }).eq("id", id);
  };

  if (!loaded) return null;

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Instagram className="w-3.5 h-3.5" />
        Instagram Posts <span className="normal-case font-normal">(curated posts displayed on the designer profile)</span>
      </label>
      <div className="mt-2 space-y-2">
        {posts.map((post) => (
          <div key={post.id} className="flex items-start gap-2">
            <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline shrink-0 w-40 truncate mt-1.5">
              {post.post_url.replace(/https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "")}
            </a>
            <Input
              value={post.caption || ""}
              onChange={(e) => handleCaptionChange(post.id, e.target.value)}
              placeholder="Caption (optional)"
              className="text-xs flex-1"
            />
            <button
              onClick={() => handleDelete(post.id)}
              className="text-muted-foreground hover:text-destructive transition-colors p-1 mt-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/..."
            className="text-xs flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          />
          <Button size="sm" variant="outline" onClick={handleAdd} disabled={!newUrl.trim()} className="text-xs h-8">
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}
interface DesignerRow {
  id: string;
  slug: string;
  name: string;
  display_name: string | null;
  specialty: string;
  biography: string;
  philosophy: string;
  notable_works: string;
  image_url: string;
  hero_image_url: string | null;
  source: string;
  is_published: boolean;
  biography_images: string[];
}

const TradeDesignersAdmin = () => {
  const { isSuperAdmin, loading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<Record<string, Partial<DesignerRow>>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewMobile, setPreviewMobile] = useState(false);
  const [previewDebug, setPreviewDebug] = useState(false);

  const { data: designers = [], isLoading } = useQuery({
    queryKey: ["admin-designers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("id, slug, name, display_name, specialty, biography, philosophy, notable_works, image_url, hero_image_url, source, is_published, biography_images")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as DesignerRow[];
    },
    enabled: !!isSuperAdmin,
  });

  // Fetch public picks count per designer for debug counter
  const { data: picksCountMap = {} } = useQuery({
    queryKey: ["admin-public-picks-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designer_curator_picks_public")
        .select("designer_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((row) => {
        if (row.designer_id) counts[row.designer_id] = (counts[row.designer_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!isSuperAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DesignerRow> }) => {
      const payload = { ...updates, updated_at: new Date().toISOString() };
      // Filter out empty strings from biography_images before saving
      if (payload.biography_images) {
        payload.biography_images = payload.biography_images.filter((u: string) => u.trim() !== "");
      }
      const { error } = await supabase
        .from("designers")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-designers"] });
      setEditBuffer((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast({ title: "Saved", description: "Designer updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    let list = designers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.display_name?.toLowerCase().includes(q)) ||
          d.specialty.toLowerCase().includes(q)
      );
    }
    if (activeLetter) {
      list = list.filter((d) => d.name[0]?.toUpperCase() === activeLetter);
    }
    return list;
  }, [designers, search, activeLetter]);

  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    designers.forEach((d) => {
      const letter = d.name[0]?.toUpperCase();
      if (letter) counts[letter] = (counts[letter] || 0) + 1;
    });
    return counts;
  }, [designers]);

  const getField = useCallback(
    (id: string, field: keyof DesignerRow) => {
      return (editBuffer[id]?.[field] ?? designers.find((d) => d.id === id)?.[field]) as string;
    },
    [editBuffer, designers]
  );

  const setField = useCallback((id: string, field: keyof DesignerRow, value: string) => {
    setEditBuffer((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }, []);

  const hasChanges = (id: string) => !!editBuffer[id] && Object.keys(editBuffer[id]).length > 0;

  /* ── Sub-component: Biography preview with duplicate-media warning ── */
  const PreviewWithDuplicateCheck = useCallback(
    ({ designer, editBuffer: eb, previewMobile: pm, previewDebug: pd, getField: gf }: {
      designer: DesignerRow;
      editBuffer: Record<string, Partial<DesignerRow>>;
      previewMobile: boolean;
      previewDebug: boolean;
      getField: (id: string, field: keyof DesignerRow) => string;
    }) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { data: curatorPicks = [] } = useQuery({
        queryKey: ["admin-designer-picks", designer.id],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("designer_curator_picks")
            .select("id, image_url, title")
            .eq("designer_id", designer.id);
          if (error) throw error;
          return data || [];
        },
      });

      const bioText = gf(designer.id, "biography") || "";
      const bioImages = (eb[designer.id]?.biography_images ?? designer.biography_images) || [];

      // Collect all bio media URLs (manual + inline)
      const bioUrls = new Set<string>();
      bioImages.forEach((raw: string) => {
        const url = raw.split("|")[0].trim();
        if (url) bioUrls.add(url);
      });
      // Extract inline URLs from biography text
      bioText.split("\n").forEach((line: string) => {
        const trimmed = line.trim();
        if (/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|mp4|mov)/i.test(trimmed)) {
          bioUrls.add(trimmed.split("|")[0].trim());
        }
      });

      // Find duplicates
      const duplicates = curatorPicks.filter((p) => bioUrls.has(p.image_url));

      return (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              Editorial render preview
            </p>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                <button
                  onClick={() => setPreviewMobile(false)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
                    !pm ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Monitor className="w-3 h-3" /> Desktop
                </button>
                <button
                  onClick={() => setPreviewMobile(true)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
                    pm ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Smartphone className="w-3 h-3" /> Mobile
                </button>
              </div>
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Debug media order
                <Switch checked={pd} onCheckedChange={setPreviewDebug} />
              </label>
            </div>
          </div>

          {duplicates.length > 0 && (
            <div className="mx-4 mb-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">{duplicates.length} image{duplicates.length > 1 ? "s" : ""} also used in Curators' Picks</span>
                {" — "}these will be deprioritised in the grid.
                <ul className="mt-1 list-disc pl-4 text-[11px] opacity-80">
                  {duplicates.map((p) => (
                    <li key={p.id} className="truncate max-w-sm">
                      <a
                        href={`/designers/${designer.slug}?highlight=${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-amber-400 underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200 transition-colors cursor-pointer"
                      >
                        {p.title} <ExternalLink className="w-2.5 h-2.5 inline-block ml-0.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className={cn(
            "mx-auto p-4 transition-all duration-300",
            pm ? "max-w-[375px] border-x border-border" : "max-w-none"
          )}>
            <Suspense fallback={<div className="h-20 flex items-center justify-center text-xs text-muted-foreground">Loading…</div>}>
              <EditorialBiography
                biography={bioText}
                biographyImages={bioImages}
                pickImages={[]}
                designerName={designer.name}
                debugMediaOrder={pd}
              />
            </Suspense>
          </div>
        </div>
      );
    },
    [setPreviewMobile, setPreviewDebug]
  );

  if (loading) return null;
  if (!isSuperAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet>
        <title>Designer Editor — Trade Admin</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl tracking-wide">Designer Editor</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {designers.length} designers · Search, filter, and edit biographies inline.
            </p>
          </div>
          <Link
            to="/trade/designers/instagram"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-body text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            <Instagram className="h-3.5 w-3.5" />
            IG Audit
          </Link>
        </div>

        {/* Search + A-Z */}
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or specialty…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveLetter(null);
              }}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setActiveLetter(null)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                !activeLetter
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {ALPHABET.map((letter) => {
              const count = letterCounts[letter] || 0;
              return (
                <button
                  key={letter}
                  onClick={() => {
                    setActiveLetter(letter === activeLetter ? null : letter);
                    setSearch("");
                  }}
                  disabled={count === 0}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    activeLetter === letter
                      ? "bg-primary text-primary-foreground"
                      : count > 0
                      ? "bg-muted text-muted-foreground hover:text-foreground"
                      : "bg-muted/50 text-muted-foreground/30 cursor-not-allowed"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No designers match your search.</p>
        ) : (
          <div className="space-y-1">
            {filtered.map((d) => {
              const isOpen = expandedId === d.id;
              const dirty = hasChanges(d.id);

              return (
                <div key={d.id} className="border border-border rounded-sm overflow-hidden">
                  {/* Row header */}
                  <button
                    onClick={() => setExpandedId(isOpen ? null : d.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                  >
                    {d.image_url && (
                      <img
                        src={d.image_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm truncate">{d.display_name || d.name}</span>
                        <Badge variant={d.is_published ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {d.is_published ? "Published" : "Draft"}
                        </Badge>
                        {(picksCountMap[d.id] ?? 0) > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                            {picksCountMap[d.id]} picks
                          </Badge>
                        )}
                        {dirty && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-secondary text-secondary">
                            Unsaved
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{d.specialty}</p>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  {/* Expanded editor */}
                  {isOpen && (
                    <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/10">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Biography</label>
                        <Textarea
                          value={getField(d.id, "biography")}
                          onChange={(e) => setField(d.id, "biography", e.target.value)}
                          rows={10}
                          className="mt-1 font-body text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Philosophy / Pull-quote</label>
                        <Textarea
                          value={getField(d.id, "philosophy")}
                          onChange={(e) => setField(d.id, "philosophy", e.target.value)}
                          rows={3}
                          className="mt-1 font-body text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Specialty</label>
                        <Input
                          value={getField(d.id, "specialty")}
                          onChange={(e) => setField(d.id, "specialty", e.target.value)}
                          className="mt-1 text-sm"
                        />
                      </div>

                      {/* Hero Image Override */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Hero Image URL <span className="normal-case font-normal">(optional — overrides card image for the profile hero)</span>
                        </label>
                        <Input
                          value={(editBuffer[d.id]?.hero_image_url ?? d.hero_image_url) || ""}
                          onChange={(e) => setField(d.id, "hero_image_url" as keyof DesignerRow, e.target.value || null)}
                          placeholder="Leave empty to use card image"
                          className="mt-1 font-mono text-xs"
                        />
                      </div>

                      {/* Editorial Media */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Editorial Media <span className="normal-case font-normal">(images, YouTube/Vimeo links, or MP4 URLs — shown between biography paragraphs)</span>
                        </label>
                        <div className="mt-2 space-y-2">
                          {((editBuffer[d.id]?.biography_images ?? d.biography_images) || []).map((entry: string, idx: number) => {
                            // Parse pipe separator: "URL | Caption"
                            const pipeMatch = entry.match(/^(https?:\/\/\S+)\s*\|\s*(.+)$/i);
                            const rawUrl = pipeMatch ? pipeMatch[1].trim() : entry.trim();
                            const caption = pipeMatch ? pipeMatch[2].trim() : null;
                            const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(rawUrl) || /youtube|youtu\.be|vimeo/i.test(rawUrl) || /res\.cloudinary\.com\/.+\/video\/upload/i.test(rawUrl);
                            return (
                              <div key={idx} className="flex items-start gap-2">
                                {isVideo ? (
                                  <div className="w-16 h-10 rounded shrink-0 bg-muted flex items-center justify-center text-muted-foreground text-[9px] font-medium">▶ Video</div>
                                ) : rawUrl.startsWith("http") ? (
                                  <img src={rawUrl} alt="" className="w-16 h-10 object-cover rounded shrink-0 bg-muted" />
                                ) : (
                                  <div className="w-16 h-10 rounded shrink-0 bg-muted" />
                                )}
                                <div className="flex-1 min-w-0 space-y-1">
                                  <Input
                                    value={entry}
                                    onChange={(e) => {
                                      const imgs = [...((editBuffer[d.id]?.biography_images ?? d.biography_images) || [])];
                                      imgs[idx] = e.target.value;
                                      setField(d.id, "biography_images" as keyof DesignerRow, imgs as any);
                                    }}
                                    placeholder="URL | Caption  (e.g. https://...jpg | My Caption)"
                                    className="text-xs"
                                  />
                                  {caption && (
                                    <p className="text-[10px] text-muted-foreground italic truncate px-1">Caption: {caption}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    const imgs = [...((editBuffer[d.id]?.biography_images ?? d.biography_images) || [])];
                                    imgs.splice(idx, 1);
                                    setField(d.id, "biography_images" as keyof DesignerRow, imgs as any);
                                  }}
                                  className="text-muted-foreground hover:text-destructive transition-colors p-1 mt-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const imgs = [...((editBuffer[d.id]?.biography_images ?? d.biography_images) || []), ""];
                              setField(d.id, "biography_images" as keyof DesignerRow, imgs as any);
                            }}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add Media
                          </Button>
                        </div>
                      </div>

                      {/* Heritage Slides */}
                      <HeritageSlideManager designerId={d.id} />

                      {/* Instagram Posts */}
                      <InstagramPostManager designerId={d.id} />

                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={getField(d.id, "is_published") as unknown as boolean}
                            onCheckedChange={(checked) => setField(d.id, "is_published", checked as unknown as string)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {getField(d.id, "is_published") ? (
                              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Published</span>
                            ) : (
                              <span className="flex items-center gap-1"><EyeOff className="w-3 h-3" /> Draft</span>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                          {dirty && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setEditBuffer((prev) => {
                                  const next = { ...prev };
                                  delete next[d.id];
                                  return next;
                                })
                              }
                            >
                              Discard
                            </Button>
                          )}
                          <Button
                            size="sm"
                            disabled={!dirty || saveMutation.isPending}
                            onClick={() => saveMutation.mutate({ id: d.id, updates: editBuffer[d.id] })}
                          >
                            <Save className="w-3.5 h-3.5 mr-1.5" />
                            Save
                          </Button>
                          <a
                            href={`/designers/${d.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            Preview <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      {/* Biography Preview Toggle */}
                      <div className="border-t border-border pt-4">
                        <button
                          onClick={() => setPreviewId(previewId === d.id ? null : d.id)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          {previewId === d.id ? "Hide" : "Show"} Biography Preview
                        </button>

                        {previewId === d.id && (
                          <PreviewWithDuplicateCheck designer={d} editBuffer={editBuffer} previewMobile={previewMobile} previewDebug={previewDebug} getField={getField} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default TradeDesignersAdmin;
