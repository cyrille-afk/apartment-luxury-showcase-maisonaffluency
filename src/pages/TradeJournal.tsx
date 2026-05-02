import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, Upload, X, ImageIcon, FileUp, Star } from "lucide-react";
import CloudUpload from "@/components/trade/CloudUpload";
import EditorialPipeline from "@/components/trade/EditorialPipeline";
import { CATEGORY_LABELS, type JournalCategory } from "@/lib/journal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  gallery_images: string[];
  pdf_url: string | null;
  category: JournalCategory;
  author: string;
  tags: string[];
  is_published: boolean;
  is_featured: boolean;
  published_at: string | null;
  read_time_minutes: number | null;
  created_at: string;
}

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [JournalCategory, string][];

const GALLERY_ENTRY_SEPARATOR = " | ";

const parseGalleryImageEntry = (raw: string) => {
  const separatorIndex = raw.indexOf(GALLERY_ENTRY_SEPARATOR);

  if (separatorIndex === -1) {
    return { imgUrl: raw.trim(), caption: "" };
  }

  return {
    imgUrl: raw.slice(0, separatorIndex).trim(),
    caption: raw.slice(separatorIndex + GALLERY_ENTRY_SEPARATOR.length),
  };
};

const buildGalleryImageEntry = (imgUrl: string, caption: string) =>
  caption ? `${imgUrl}${GALLERY_ENTRY_SEPARATOR}${caption}` : imgUrl;

const sanitizeGalleryImageEntry = (raw: string) => {
  const { imgUrl, caption } = parseGalleryImageEntry(raw);
  const trimmedCaption = caption.trim();

  return trimmedCaption ? buildGalleryImageEntry(imgUrl, trimmedCaption) : imgUrl;
};

const emptyArticle = (): Omit<Article, "id" | "created_at"> => ({
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  cover_image_url: "",
  gallery_images: [],
  pdf_url: null,
  category: "design_trend",
  author: "Maison Affluency",
  tags: [],
  is_published: false,
  is_featured: false,
  published_at: null,
  read_time_minutes: 5,
});

const TradeJournal = () => {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState<Omit<Article, "id" | "created_at"> & { id?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  // uploading state now managed by CloudUpload component

  useEffect(() => {
    if (isAdmin) fetchArticles();
  }, [isAdmin]);

  const fetchArticles = async () => {
    setFetching(true);
    const { data } = await supabase
      .from("journal_articles")
      .select("*")
      .order("created_at", { ascending: false });
    setArticles((data as Article[]) || []);
    setFetching(false);
  };

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const startNew = () => {
    setEditing(emptyArticle());
    setTagsInput("");
  };

  const startEdit = (a: Article) => {
    setEditing({ ...a });
    setTagsInput(a.tags?.join(", ") || "");
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.slug.trim()) {
      toast({ title: "Title and slug are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    const payload = {
      title: editing.title,
      slug: editing.slug,
      excerpt: editing.excerpt,
      content: editing.content,
      cover_image_url: editing.cover_image_url || null,
      gallery_images: (editing.gallery_images || []).map(sanitizeGalleryImageEntry),
      pdf_url: editing.pdf_url || null,
      category: editing.category,
      author: editing.author,
      tags,
      is_published: editing.is_published,
      published_at: editing.is_published && !editing.published_at
        ? new Date().toISOString()
        : editing.published_at,
      read_time_minutes: editing.read_time_minutes,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editing.id) {
      ({ error } = await supabase.from("journal_articles").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("journal_articles").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: editing.id ? "Article updated" : "Article created" });
    setEditing(null);
    fetchArticles();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("journal_articles").delete().eq("id", deleteTarget.id);
    toast({ title: "Article deleted" });
    setDeleteTarget(null);
    fetchArticles();
  };

  const togglePublish = async (a: Article) => {
    const newStatus = !a.is_published;
    await supabase.from("journal_articles").update({
      is_published: newStatus,
      published_at: newStatus && !a.published_at ? new Date().toISOString() : a.published_at,
      updated_at: new Date().toISOString(),
    }).eq("id", a.id);
    toast({ title: newStatus ? "Published" : "Unpublished" });
    fetchArticles();
  };

  const toggleFeatured = async (a: Article) => {
    if (a.is_featured) {
      const { error } = await supabase.from("journal_articles")
        .update({ is_featured: false, updated_at: new Date().toISOString() })
        .eq("id", a.id);
      if (error) {
        toast({ title: "Could not update", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Featured Read cleared", description: `"${a.title}" is no longer the homepage Featured Read.` });
      fetchArticles();
      return;
    }

    // Clear any existing featured first (partial unique index requires this)
    const { error: clearErr } = await supabase.from("journal_articles")
      .update({ is_featured: false, updated_at: new Date().toISOString() })
      .eq("is_featured", true);
    if (clearErr) {
      toast({ title: "Could not update", description: clearErr.message, variant: "destructive" });
      return;
    }
    const { error: setErr } = await supabase.from("journal_articles")
      .update({ is_featured: true, updated_at: new Date().toISOString() })
      .eq("id", a.id);
    if (setErr) {
      toast({ title: "Could not update", description: setErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "Featured Read set", description: `"${a.title}" now appears in the homepage banner.` });
    fetchArticles();
  };

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  // Editor view
  if (editing) {
    return (
      <>
        <Helmet><title>{editing.id ? "Edit" : "New"} Article — Admin — Maison Affluency</title></Helmet>
        <div className="max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display text-2xl text-foreground">
              {editing.id ? "Edit Article" : "New Article"}
            </h1>
            <button
              onClick={() => setEditing(null)}
              className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-5">
            {/* Title */}
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Title</label>
              <input
                value={editing.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setEditing(prev => prev ? {
                    ...prev,
                    title,
                    slug: prev.id ? prev.slug : generateSlug(title),
                  } : null);
                }}
                className="w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors"
                placeholder="Article title"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Slug</label>
              <input
                value={editing.slug}
                onChange={(e) => setEditing(prev => prev ? { ...prev, slug: e.target.value } : null)}
                className="w-full pb-2 border-b border-border bg-transparent font-body text-xs text-muted-foreground outline-none focus:border-foreground transition-colors font-mono"
                placeholder="article-url-slug"
              />
            </div>

            {/* Category + Author row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Category</label>
                <select
                  value={editing.category}
                  onChange={(e) => setEditing(prev => prev ? { ...prev, category: e.target.value as JournalCategory } : null)}
                  className="w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none"
                >
                  {CATEGORIES.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Author</label>
                <input
                  value={editing.author}
                  onChange={(e) => setEditing(prev => prev ? { ...prev, author: e.target.value } : null)}
                  className="w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors"
                />
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Read time (min)</label>
                <input
                  type="number"
                  min={1}
                  value={editing.read_time_minutes || ""}
                  onChange={(e) => setEditing(prev => prev ? { ...prev, read_time_minutes: parseInt(e.target.value) || null } : null)}
                  className="w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors"
                />
              </div>
            </div>

            {/* Cover image */}
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Cover Image</label>
              <div className="flex items-center gap-3">
                <CloudUpload
                  folder="journal/covers"
                  accept="image/*"
                  label="Upload cover"
                  onUpload={(urls) => setEditing(prev => prev ? { ...prev, cover_image_url: urls[0] } : null)}
                />
                {editing.cover_image_url && (
                  <button
                    onClick={() => setEditing(prev => prev ? { ...prev, cover_image_url: "" } : null)}
                    className="p-1 rounded-full hover:bg-muted transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              <input
                value={editing.cover_image_url || ""}
                onChange={(e) => setEditing(prev => prev ? { ...prev, cover_image_url: e.target.value } : null)}
                className="w-full mt-2 pb-2 border-b border-border bg-transparent font-body text-[10px] text-muted-foreground/60 outline-none focus:border-foreground transition-colors font-mono"
                placeholder="Or paste image URL…"
              />
              {editing.cover_image_url && (
                <div className="mt-3 aspect-[16/9] max-w-sm overflow-hidden rounded-sm border border-border">
                  <img src={editing.cover_image_url} alt="Cover preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* PDF Document */}
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">
                PDF Document <span className="text-muted-foreground/50">(embedded viewer + download)</span>
              </label>
              <div className="flex items-center gap-3">
                <CloudUpload
                  folder="journal/pdfs"
                  accept="application/pdf,.pdf"
                  label="Upload PDF"
                  onUpload={(urls) => setEditing(prev => prev ? { ...prev, pdf_url: urls[0] } : null)}
                />
                {editing.pdf_url && (
                  <button
                    onClick={() => setEditing(prev => prev ? { ...prev, pdf_url: null } : null)}
                    className="p-1 rounded-full hover:bg-muted transition-colors"
                    aria-label="Remove PDF"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              {editing.pdf_url && (
                <p className="mt-2 font-body text-[10px] text-primary truncate max-w-full">
                  ✓ PDF attached — <a href={editing.pdf_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{editing.pdf_url.split("/").pop()}</a>
                </p>
              )}
              <input
                value={editing.pdf_url || ""}
                onChange={(e) => setEditing(prev => prev ? { ...prev, pdf_url: e.target.value } : null)}
                className="w-full mt-2 pb-2 border-b border-border bg-transparent font-body text-[10px] text-muted-foreground/60 outline-none focus:border-foreground transition-colors font-mono"
                placeholder="Or paste URL manually…"
              />
            </div>


            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">
                Gallery Photos <span className="text-muted-foreground/50">(for photo-focused articles)</span>
              </label>
              
              {/* Upload button */}
              <CloudUpload
                folder="journal/gallery"
                accept="image/*"
                multiple
                label="Upload photos"
                onUpload={(urls) => setEditing(prev => prev ? { ...prev, gallery_images: [...(prev.gallery_images || []), ...urls] } : null)}
              />

              {/* URL input for external images */}
              <div className="mt-2 flex gap-2">
                <input
                  id="gallery-url-input"
                  placeholder="Or paste image URL and press Enter"
                  className="flex-1 pb-2 border-b border-border bg-transparent font-body text-xs text-muted-foreground outline-none focus:border-foreground transition-colors font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const input = e.currentTarget;
                      const url = input.value.trim();
                      if (url) {
                        setEditing(prev => prev ? { ...prev, gallery_images: [...(prev.gallery_images || []), url] } : null);
                        input.value = "";
                      }
                    }
                  }}
                />
              </div>

              {/* Gallery preview grid with captions */}
              {editing.gallery_images && editing.gallery_images.length > 0 && (
                <div className="mt-4 space-y-3">
                  {editing.gallery_images.map((raw, i) => {
                    const { imgUrl, caption } = parseGalleryImageEntry(raw);
                    return (
                    <div key={i} className="flex gap-3 items-start border border-border rounded-md p-2 group">
                      <div className="relative w-20 h-20 flex-shrink-0 rounded-sm overflow-hidden">
                        <img src={imgUrl} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0.5 left-0.5 font-body text-[9px] text-white/70 bg-black/40 px-1 rounded">
                          {i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-mono text-[9px] text-muted-foreground/60 truncate">{imgUrl}</p>
                        <input
                          value={caption}
                          onChange={(e) => {
                            const newCaption = e.target.value;
                            setEditing(prev => prev ? {
                              ...prev,
                              gallery_images: prev.gallery_images.map((g, idx) => idx === i ? buildGalleryImageEntry(imgUrl, newCaption) : g)
                            } : null);
                          }}
                          spellCheck={false}
                          autoCorrect="off"
                          autoCapitalize="words"
                          className="w-full pb-1 border-b border-border bg-transparent font-body text-xs text-foreground outline-none focus:border-foreground transition-colors"
                          placeholder="Photo caption (e.g. Designer Name, 'Title', 2025)"
                        />
                        <button
                          type="button"
                          title="Insert image URL into content at cursor"
                          className="font-body text-[10px] text-primary/70 hover:text-primary transition-colors"
                          onClick={() => {
                            const ta = document.getElementById("journal-content-editor") as HTMLTextAreaElement | null;
                            if (!ta || !editing) return;
                            const pos = ta.selectionStart;
                            const text = editing.content;
                            const insertion = `\n![${caption.trim() || 'image'}](${imgUrl})\n`;
                            const newContent = text.substring(0, pos) + insertion + text.substring(pos);
                            setEditing(prev => prev ? { ...prev, content: newContent } : null);
                            requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(pos + insertion.length, pos + insertion.length); });
                          }}
                        >
                          ↳ Insert in content
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditing(prev => prev ? { ...prev, gallery_images: prev.gallery_images.filter((_, idx) => idx !== i) } : null)}
                        className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors"
                        aria-label="Remove image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Excerpt */}
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Excerpt</label>
              <textarea
                rows={2}
                value={editing.excerpt}
                onChange={(e) => setEditing(prev => prev ? { ...prev, excerpt: e.target.value } : null)}
                className="w-full p-3 border border-border rounded-md bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors resize-y"
                placeholder="Short summary for listing cards and SEO..."
              />
            </div>

            {/* Content (Markdown) */}
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">
                Content <span className="text-muted-foreground/50">(Markdown)</span>
              </label>
              <div className="flex items-center gap-1 mb-1 flex-wrap">
                {[
                  { label: "B", wrap: "**", title: "Bold" },
                  { label: "I", wrap: "*", title: "Italic" },
                  { label: "H2", prefix: "## ", title: "Heading 2" },
                  { label: "H3", prefix: "### ", title: "Heading 3" },
                  { label: "Link", title: "Link" },
                  { label: "❝", prefix: "> ", title: "Blockquote" },
                  { label: "—", prefix: "\n---\n", title: "Divider" },
                  { label: "📷", title: "Inline Image" },
                  { label: "🖼️🖼️", title: "Side-by-side image pair" },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    title={btn.title}
                    className="px-2 py-1 text-[11px] font-mono border border-border rounded hover:bg-muted transition-colors"
                    style={btn.label === "B" ? { fontWeight: 700 } : btn.label === "I" ? { fontStyle: "italic" } : undefined}
                    onClick={() => {
                      const ta = document.getElementById("journal-content-editor") as HTMLTextAreaElement | null;
                      if (!ta || !editing) return;
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const text = editing.content;
                      const selected = text.substring(start, end);
                      let replacement: string;
                      let cursorOffset: number;
                      if (btn.label === "📷") {
                        const imgUrl = selected || prompt("Paste image URL:") || "";
                        if (!imgUrl) return;
                        const alt = prompt("Alt text / caption (optional):") || "image";
                        replacement = `\n![${alt}](${imgUrl})\n`;
                        cursorOffset = start + replacement.length;
                      } else if (btn.label === "🖼️🖼️") {
                        const url1 = prompt("First image URL:") || "";
                        if (!url1) return;
                        const cap1 = prompt("First caption (optional):") || "";
                        const url2 = prompt("Second image URL:") || "";
                        if (!url2) return;
                        const cap2 = prompt("Second caption (optional):") || "";
                        const line1 = cap1 ? `${url1} | ${cap1}` : url1;
                        const line2 = cap2 ? `${url2} | ${cap2}` : url2;
                        replacement = `\n\n:::pair\n${line1}\n${line2}\n:::\n\n`;
                        cursorOffset = start + replacement.length;
                      } else if (btn.label === "Link") {
                        replacement = selected ? `[${selected}](url)` : `[link text](url)`;
                        cursorOffset = selected ? start + selected.length + 3 : start + 1;
                      } else if (btn.prefix) {
                        replacement = btn.prefix + selected;
                        cursorOffset = start + btn.prefix.length + selected.length;
                      } else if (btn.wrap) {
                        replacement = `${btn.wrap}${selected || "bold text"}${btn.wrap}`;
                        cursorOffset = selected ? end + btn.wrap.length * 2 : start + btn.wrap.length;
                      } else {
                        return;
                      }
                      const newContent = text.substring(0, start) + replacement + text.substring(end);
                      setEditing(prev => prev ? { ...prev, content: newContent } : null);
                      requestAnimationFrame(() => {
                        ta.focus();
                        const selectStart = btn.wrap && !selected ? start + btn.wrap.length : cursorOffset;
                        const selectEnd = btn.wrap && !selected ? start + btn.wrap.length + (btn.label === "B" ? 9 : 11) : cursorOffset;
                        ta.setSelectionRange(selectStart, selectEnd);
                      });
                    }}
                  />
                ))}
              </div>
              <textarea
                id="journal-content-editor"
                rows={16}
                value={editing.content}
                onChange={(e) => setEditing(prev => prev ? { ...prev, content: e.target.value } : null)}
                className="w-full p-3 border border-border rounded-md bg-transparent font-body text-xs text-foreground outline-none focus:border-foreground transition-colors resize-y font-mono leading-relaxed"
                placeholder="Write article content in Markdown. Use **bold**, *italic*, ## headings..."
              />
            </div>

            {/* Tags */}
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Tags (comma-separated)</label>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors"
                placeholder="collectible design, singapore, luxury interiors"
              />
            </div>

            {/* Publish toggle + save */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_published}
                  onChange={(e) => setEditing(prev => prev ? { ...prev, is_published: e.target.checked } : null)}
                  className="w-4 h-4 accent-foreground"
                />
                <span className="font-body text-sm text-foreground">Publish immediately</span>
              </label>

              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving..." : editing.id ? "Update Article" : "Create Article"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // List view
  return (
    <>
      <Helmet><title>Journal — Admin — Maison Affluency</title></Helmet>
      <div className="max-w-5xl space-y-8">
        {/* Editorial Pipeline Widget */}
        <EditorialPipeline />

        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-foreground">Journal Articles</h1>
          <button
            onClick={startNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            New Article
          </button>
        </div>

        {fetching ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse border border-border rounded-lg p-5">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg">
            <p className="font-display text-lg text-foreground mb-2">No articles yet</p>
            <p className="font-body text-sm text-muted-foreground mb-6">Create your first article to get started.</p>
            <button
              onClick={startNew}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Article
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((a) => (
              <div key={a.id} className="border border-border rounded-lg p-5 flex items-start gap-4">
                {/* Thumbnail */}
                {a.cover_image_url && (
                  <div className="w-20 h-14 rounded-sm overflow-hidden shrink-0 hidden md:block">
                    <img src={a.cover_image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display text-base text-foreground truncate">{a.title}</h3>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-body uppercase tracking-wider ${
                      a.is_published ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    }`}>
                      {a.is_published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="font-body text-xs text-muted-foreground truncate">{a.excerpt || "No excerpt"}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="font-body text-[10px] text-primary uppercase tracking-wider">{CATEGORY_LABELS[a.category]}</span>
                    <span className="font-body text-[10px] text-muted-foreground">{a.author}</span>
                    <span className="font-body text-[10px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={`/journal/${a.slug}${a.is_published ? '' : '?preview=true'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={a.is_published ? "View" : "Preview draft"}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => togglePublish(a)}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={a.is_published ? "Unpublish" : "Publish"}
                  >
                    {a.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => startEdit(a)}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(a)}
                    className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete Article</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Are you sure you want to delete "<span className="font-medium text-foreground">{deleteTarget?.title}</span>"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="font-body text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TradeJournal;
