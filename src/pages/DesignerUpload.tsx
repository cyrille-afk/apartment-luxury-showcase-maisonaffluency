import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Loader2, AlertCircle, Image } from "lucide-react";

const CLOUD_NAME = "dif1oamtj";
const UPLOAD_PRESET = "maison_designer_uploads";
const WIDGET_SRC = "https://upload-widget.cloudinary.com/global/all.js";

declare global {
  interface Window {
    cloudinary?: any;
  }
}

type FileStatus = "queued" | "uploading" | "complete" | "error";

type FileItem = {
  id: string;
  name: string;
  status: FileStatus;
  progress: number;
  url?: string;
  thumb?: string;
  format?: string;
  bytes?: number;
  error?: string;
};

function toSlug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatBytes(b?: number) {
  if (!b) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = b;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

export default function DesignerUpload() {
  const { slug } = useParams<{ slug: string }>();
  const [designerName, setDesignerName] = useState<string>("");
  const [resolvedSlug, setResolvedSlug] = useState<string>(slug || "");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [overall, setOverall] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const widgetRef = useRef<any>(null);

  const folder = useMemo(
    () => `designers/${resolvedSlug || slug || "unknown"}`,
    [resolvedSlug, slug]
  );

  // Look up designer
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("designers")
        .select("id, name, slug");
      if (cancelled) return;
      const match = (data || []).find(
        (d: any) => d.slug === slug || toSlug(d.name) === slug
      );
      if (!match) {
        setNotFound(true);
      } else {
        setDesignerName(match.name);
        setResolvedSlug(match.slug || toSlug(match.name));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Load Cloudinary widget script
  useEffect(() => {
    if (window.cloudinary) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector(
      `script[src="${WIDGET_SRC}"]`
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => setScriptReady(true));
      return;
    }
    const s = document.createElement("script");
    s.src = WIDGET_SRC;
    s.async = true;
    s.onload = () => setScriptReady(true);
    document.body.appendChild(s);
  }, []);

  // Build widget once script + designer resolved
  useEffect(() => {
    if (!scriptReady || !window.cloudinary || notFound || loading) return;
    if (widgetRef.current) {
      try {
        widgetRef.current.destroy();
      } catch {}
      widgetRef.current = null;
    }
    widgetRef.current = window.cloudinary.createUploadWidget(
      {
        cloudName: CLOUD_NAME,
        uploadPreset: UPLOAD_PRESET,
        folder,
        sources: ["local", "url", "camera", "dropbox", "google_drive"],
        multiple: true,
        maxFiles: 50,
        resourceType: "auto",
        showAdvancedOptions: false,
        showPoweredBy: false,
        styles: {
          palette: {
            window: "#ffffff",
            sourceBg: "#fafaf7",
            windowBorder: "#e5e2d8",
            tabIcon: "#1f3a34",
            inactiveTabIcon: "#8b8b87",
            menuIcons: "#1f3a34",
            link: "#1f3a34",
            action: "#1f3a34",
            inProgress: "#1f3a34",
            complete: "#5b8a78",
            error: "#b04a3a",
            textDark: "#1a1a1a",
            textLight: "#ffffff",
          },
        },
      },
      (error: any, result: any) => {
        if (error) {
          toast.error(error?.statusText || "Upload error");
          setIsUploading(false);
          return;
        }

        const info = result?.info;
        const event = result?.event;

        if (event === "upload-added" && info?.id) {
          setFiles((prev) => {
            if (prev.some((f) => f.id === info.id)) return prev;
            return [
              ...prev,
              {
                id: info.id,
                name: info.file?.name || info.public_id || "Untitled",
                status: "queued",
                progress: 0,
              },
            ];
          });
        }

        if (event === "queues-start") {
          setIsUploading(true);
        }

        if (event === "upload-progress" && info?.id) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === info.id
                ? {
                    ...f,
                    status: "uploading",
                    progress: Math.round(info.progress || 0),
                  }
                : f
            )
          );
        }

        if (event === "success" && info?.id) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === info.id
                ? {
                    ...f,
                    status: "complete",
                    progress: 100,
                    url: info.secure_url,
                    thumb: info.thumbnail_url || info.secure_url,
                    name: info.original_filename || info.public_id,
                    format: info.format,
                    bytes: info.bytes,
                  }
                : f
            )
          );
          toast.success(`Uploaded ${info.original_filename}.${info.format}`);
        }

        if (event === "error" && info?.id) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === info.id
                ? { ...f, status: "error", error: info.error?.message || "Failed" }
                : f
            )
          );
          toast.error(`${info.file?.name || info.id} failed to upload`);
        }

        if (event === "queues-end") {
          setIsUploading(false);
          toast.success("All uploads complete");
        }
      }
    );
  }, [scriptReady, folder, notFound, loading]);

  // Derive overall progress
  useEffect(() => {
    if (files.length === 0) {
      setOverall(0);
      return;
    }
    const total = files.reduce((sum, f) => sum + f.progress, 0);
    setOverall(Math.round(total / files.length));
  }, [files]);

  const openWidget = () => {
    if (widgetRef.current) widgetRef.current.open();
  };

  // Drag-and-drop on the page itself triggers the widget
  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      if (widgetRef.current) widgetRef.current.open();
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm tracking-wide opacity-60">Loading…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-2xl font-serif mb-2">Designer not found</h1>
          <p className="text-sm opacity-60">
            We couldn't find a designer matching "{slug}".
          </p>
        </div>
      </div>
    );
  }

  const statusIcon = (status: FileStatus) => {
    switch (status) {
      case "complete":
        return <Check className="w-4 h-4 text-emerald-600" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "uploading":
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default:
        return <Image className="w-4 h-4 text-muted-foreground opacity-60" />;
    }
  };

  const statusLabel = (status: FileStatus) => {
    switch (status) {
      case "complete":
        return "Complete";
      case "error":
        return "Error";
      case "uploading":
        return "Uploading";
      default:
        return "Queued";
    }
  };

  const completeCount = files.filter((f) => f.status === "complete").length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.25em] opacity-60 mb-3">
            Maison Affluency · Atelier upload
          </p>
          <h1 className="text-4xl md:text-5xl font-serif leading-tight mb-3">
            {designerName}
          </h1>
          <p className="text-sm opacity-70">
            Upload product images, lookbooks, line drawings, certificates or any
            reference files. Files land in{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
              {folder}
            </code>{" "}
            on our media library.
          </p>
        </header>

        <button
          onClick={openWidget}
          disabled={!scriptReady}
          className="w-full border-2 border-dashed rounded-2xl py-16 px-8 text-center transition hover:bg-muted/40 disabled:opacity-50"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <div className="text-lg font-medium mb-1">
            {scriptReady
              ? "Drop files here or click to upload"
              : "Preparing uploader…"}
          </div>
          <div className="text-xs opacity-60">
            Images, PDFs, videos — up to 50 files at once
          </div>
        </button>

        {/* Overall progress bar */}
        {files.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-[0.2em] opacity-70">
                {isUploading ? "Uploading" : "Done"}
              </span>
              <span className="text-xs font-medium opacity-80">
                {completeCount} of {files.length}
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-500 ease-out rounded-full"
                style={{ width: `${overall}%` }}
              />
            </div>
          </div>
        )}

        {/* Per-file status list */}
        {files.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs uppercase tracking-[0.25em] opacity-60 mb-4">
              Files ({files.length})
            </h2>
            <div className="space-y-3">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:bg-accent/5"
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                    {f.thumb && /jpg|jpeg|png|webp|gif|avif/i.test(f.format || "") ? (
                      <img
                        src={f.thumb}
                        alt={f.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Image className="w-5 h-5 text-muted-foreground opacity-40" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      {f.format && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted opacity-70 flex-shrink-0">
                          {f.format}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] opacity-60">
                        {formatBytes(f.bytes)}
                      </span>
                      <span
                        className={`text-[11px] font-medium flex items-center gap-1 ${
                          f.status === "complete"
                            ? "text-emerald-600"
                            : f.status === "error"
                            ? "text-red-500"
                            : "opacity-70"
                        }`}
                      >
                        {statusIcon(f.status)}
                        {statusLabel(f.status)}
                      </span>
                    </div>

                    {/* Individual progress bar */}
                    {f.status === "uploading" && (
                      <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-primary transition-[width] duration-300 ease-out rounded-full"
                          style={{ width: `${f.progress}%` }}
                        />
                      </div>
                    )}
                    {f.status === "error" && f.error && (
                      <p className="text-[11px] text-red-500 mt-1">{f.error}</p>
                    )}
                  </div>

                  {/* Link to completed file */}
                  {f.url && (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline underline-offset-2 opacity-80 hover:opacity-100 flex-shrink-0"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-16 text-[11px] opacity-50">
          Files are stored securely. You can close this tab anytime — uploads
          finish in the background while the window stays open.
        </footer>
      </div>
    </div>
  );
}

