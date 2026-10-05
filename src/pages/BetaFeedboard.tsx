import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Helmet } from "react-helmet-async";
import { Download, Maximize, Minus, Plus, Upload, X, ImageIcon } from "lucide-react";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";

type Lane = "bug_hunt" | "workflow" | "copilot";
type Entry = {
  id: string;
  user_id: string;
  lane: Lane;
  title: string;
  observations: string | null;
  screenshot_path: string | null;
  author_name: string | null;
  author_company: string | null;
  viewport_tag: string | null;
  browser: string | null;
  os: string | null;
  viewport_dims: string | null;
  created_at: string;
};

const editorialDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const viewportTag = () => {
  const w = window.innerWidth;
  return w < 768 ? "Mobile Viewport" : w <= 1024 ? "Tablet Viewport" : "Desktop Viewport";
};

const detectBrowser = (ua: string) => {
  if (/edg/i.test(ua)) return "Edge";
  if (/opr|opera/i.test(ua)) return "Opera";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  return "Other";
};

const detectOS = (ua: string) => {
  if (/windows nt/i.test(ua)) return "Windows";
  if (/mac os x/i.test(ua)) return "macOS";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
};

const deviceContext = () => {
  const ua = navigator.userAgent;
  return {
    browser: detectBrowser(ua),
    os: detectOS(ua),
    viewport_dims: `${window.innerWidth} × ${window.innerHeight}`,
  };
};

const LANES: { key: Lane; title: string; hint: string }[] = [
  { key: "bug_hunt", title: "BUG HUNT", hint: "Interface alignment issues, text truncations or broken loops." },
  { key: "workflow", title: "WORKFLOW REFINEMENTS", hint: "Pricing matrix calculations or navigation speeds." },
  { key: "copilot", title: "CO-PILOT REQUESTS", hint: "New AI extension features or custom document sheets." },
];

export default function BetaFeedboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openLane, setOpenLane] = useState<Lane | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("beta_feedback_entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Could not load feedback");
    setEntries((data as Entry[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-8 bg-background text-foreground">
      <Helmet><title>Beta Feedboard — Maison Affluency</title><meta name="robots" content="noindex" /></Helmet>
      <header className="mb-8 border-b border-border pb-6">
        <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Private Beta</p>
        <h1 className="font-display text-3xl">Beta Feedboard</h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-muted-foreground">
          Log bugs, refinements and co-pilot ideas. Your name and the time are attached automatically.
        </p>
      </header>

      <div className="flex flex-col gap-6 md:flex-row">
        {LANES.map((lane) => {
          const items = entries.filter((e) => e.lane === lane.key);
          return (
            <section key={lane.key} className="flex min-w-0 flex-1 flex-col border border-border bg-card">
              <div className="flex items-start justify-between gap-3 border-b border-border p-4">
                <div className="min-w-0">
                  <h2 className="font-body text-xs font-medium tracking-[0.18em]">{lane.title}</h2>
                  <p className="mt-1 font-body text-[11px] text-muted-foreground">{lane.hint}</p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 text-[10px] tracking-[0.15em]" onClick={() => setOpenLane(lane.key)}>
                  <Plus className="mr-1 h-3 w-3" /> LOG AN ENTRY
                </Button>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {loading ? (
                  <p className="p-4 font-body text-xs text-muted-foreground">Loading…</p>
                ) : items.length === 0 ? (
                  <p className="p-4 font-body text-xs text-muted-foreground">No entries yet.</p>
                ) : items.map((e) => <EntryCard key={e.id} entry={e} />)}
              </div>
            </section>
          );
        })}
      </div>

      <EntryDrawer lane={openLane} onClose={() => setOpenLane(null)} onSaved={load} />
    </div>
  );
}

function TransformUtils() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  const btn = "cursor-pointer rounded-full p-2 text-foreground transition-colors hover:bg-muted";
  return (
    <>
      <button type="button" aria-label="Zoom in" title="Zoom in" className={btn} onClick={() => zoomIn(0.5)}>
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="Zoom out" title="Zoom out" className={btn} onClick={() => zoomOut(0.5)}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="Reset view" title="Reset view" className={btn} onClick={() => resetTransform()}>
        <Maximize className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

function EntryCard({ entry }: { entry: Entry }) {
  const [url, setUrl] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    if (!entry.screenshot_path) return;
    supabase.storage.from("beta-feedback").createSignedUrl(entry.screenshot_path, 300)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [entry.screenshot_path]);

  const downloadImage = async () => {
    if (!url || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ext = blob.type.split("/")[1]?.split(";")[0] || "png";
      a.href = objectUrl;
      a.download = `beta-screenshot-${entry.id.slice(0, 8)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Could not download screenshot");
    } finally {
      setDownloading(false);
    }
  };
  return (
    <article className="p-4">
      <h3 className="font-body text-sm font-medium break-words">{entry.title}</h3>
      {entry.observations && <p className="mt-1 whitespace-pre-wrap break-words font-body text-xs text-muted-foreground">{entry.observations}</p>}
      {url && (
        <button
          type="button"
          onClick={() => setLightbox(true)}
          aria-label="Open screenshot full size"
          className="mt-3 block w-full cursor-pointer"
        >
          <img src={url} alt="Screenshot" className="max-h-40 w-full border border-border object-contain transition-opacity hover:opacity-90" />
        </button>
      )}
      {lightbox && url && createPortal(
        <div
          className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-background/80 p-6 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot viewer"
        >
          <button
            type="button"
            aria-label="Close screenshot"
            className="absolute right-6 top-6 cursor-pointer rounded-full border border-border bg-background/80 p-2 text-foreground transition-colors hover:bg-muted"
            onClick={() => setLightbox(false)}
          >
            <X className="h-4 w-4" />
          </button>
          <TransformWrapper
            minScale={1}
            maxScale={8}
            doubleClick={{ mode: "toggle", step: 2 }}
            wheel={{ step: 0.15 }}
            pinch={{ step: 5 }}
            centerOnInit
          >
            <div
              className="relative flex max-h-[90vh] max-w-[92vw] cursor-default flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <TransformComponent wrapperClass="!h-[80vh] !max-w-[92vw]" contentClass="!max-w-[92vw]">
                <img
                  src={url}
                  alt="Screenshot full view"
                  className="max-h-[80vh] max-w-[92vw] select-none border border-border object-contain shadow-2xl"
                  draggable={false}
                />
              </TransformComponent>
              <p className="pointer-events-none absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 whitespace-nowrap font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                Scroll to zoom · drag to pan · double-click to toggle
              </p>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background/90 p-1 shadow-lg backdrop-blur-sm">
                <TransformUtils />
                <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
                <button
                  type="button"
                  aria-label="Download screenshot"
                  title="Download full-resolution image"
                  className={btn}
                  disabled={downloading}
                  onClick={downloadImage}
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </TransformWrapper>
        </div>,
        document.body
      )}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-2">
        <div className="min-w-0">
          <p className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">Logged by</p>
          <p className="truncate font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {[entry.author_name, entry.author_company].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">Captured</p>
          <p className="truncate font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{editorialDate(entry.created_at)}</p>
        </div>
        <div className="min-w-0">
          <p className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">Environment</p>
          <p className="truncate font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{entry.viewport_tag ?? "—"}</p>
        </div>
        <div className="min-w-0">
          <p className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">Browser</p>
          <p className="truncate font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{entry.browser ?? "—"}</p>
        </div>
        <div className="min-w-0">
          <p className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">System</p>
          <p className="truncate font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{entry.os ?? "—"}</p>
        </div>
        <div className="min-w-0">
          <p className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">Viewport</p>
          <p className="truncate font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{entry.viewport_dims ?? "—"}</p>
        </div>
      </div>
    </article>
  );
}

function EntryDrawer({ lane, onClose, onSaved }: { lane: Lane | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [obs, setObs] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setTitle(""); setObs(""); setFile(null); };
  const pick = (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please attach an image");
    if (f.size > 10 * 1024 * 1024) return toast.error("Image must be under 10 MB");
    setFile(f);
  };

  const submit = async () => {
    if (!user || !lane || !title.trim()) return;
    setSaving(true);
    let screenshot_path: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("beta-feedback").upload(path, file, { contentType: file.type });
      if (error) { setSaving(false); return toast.error("Screenshot upload failed"); }
      screenshot_path = path;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, company")
      .eq("id", user.id)
      .maybeSingle();
    const author_name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || null;
    const { error } = await supabase.from("beta_feedback_entries").insert({
      user_id: user.id,
      lane,
      title: title.trim().slice(0, 200),
      observations: obs.trim().slice(0, 5000) || null,
      screenshot_path,
      author_name,
      author_company: profile?.company?.trim() || null,
      viewport_tag: viewportTag(),
      ...deviceContext(),
    });
    setSaving(false);
    if (error) return toast.error("Could not save entry");
    toast.success("Entry logged");
    reset(); onClose(); onSaved();
  };

  return (
    <Sheet open={!!lane} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Log an entry — {LANES.find((l) => l.key === lane)?.title}</SheetTitle>
          <SheetDescription className="font-body text-xs">Your account and the time are recorded automatically.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-4">
          <div>
            <label className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Title</label>
            <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Observations</label>
            <Textarea rows={5} value={obs} maxLength={5000} onChange={(e) => setObs(e.target.value)} />
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed p-6 text-center transition-colors ${drag ? "border-foreground bg-muted" : "border-border"}`}
          >
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            {file ? (
              <div className="flex items-center gap-2 font-body text-xs">
                <ImageIcon className="h-4 w-4" /> {file.name}
                <button type="button" aria-label="Remove screenshot" onClick={(e) => { e.stopPropagation(); setFile(null); }}><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <>
                <Upload className="h-5 w-5 text-muted-foreground" />
                <p className="font-body text-xs text-muted-foreground">Drop an interface screenshot or click to browse</p>
              </>
            )}
          </div>
          <Button onClick={submit} disabled={saving || !title.trim()}>{saving ? "Saving…" : "Submit entry"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
