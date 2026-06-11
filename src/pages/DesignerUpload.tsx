import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CLOUD_NAME = "dif1oamtj";
const UPLOAD_PRESET = "maison_designer_uploads";
const WIDGET_SRC = "https://upload-widget.cloudinary.com/global/all.js";

declare global {
  interface Window {
    cloudinary?: any;
  }
}

type Uploaded = {
  id: string;
  url: string;
  thumb: string;
  name: string;
  format: string;
  bytes: number;
};

function toSlug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function DesignerUpload() {
  const { slug } = useParams<{ slug: string }>();
  const [designerName, setDesignerName] = useState<string>("");
  const [resolvedSlug, setResolvedSlug] = useState<string>(slug || "");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [uploads, setUploads] = useState<Uploaded[]>([]);
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
          return;
        }
        if (result?.event === "success") {
          const info = result.info;
          setUploads((prev) => [
            {
              id: info.asset_id || info.public_id,
              url: info.secure_url,
              thumb: info.thumbnail_url || info.secure_url,
              name: info.original_filename || info.public_id,
              format: info.format,
              bytes: info.bytes,
            },
            ...prev,
          ]);
          toast.success(`Uploaded ${info.original_filename}.${info.format}`);
        }
        if (result?.event === "queues-end") {
          toast.success("All uploads complete");
        }
      }
    );
  }, [scriptReady, folder, notFound, loading]);

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
            Upload product images, lookbooks, line drawings, certificates or
            any reference files. Files land in{" "}
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
            {scriptReady ? "Drop files here or click to upload" : "Preparing uploader…"}
          </div>
          <div className="text-xs opacity-60">
            Images, PDFs, videos — up to 50 files at once
          </div>
        </button>

        {uploads.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xs uppercase tracking-[0.25em] opacity-60 mb-4">
              Uploaded this session ({uploads.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {uploads.map((u) => (
                <a
                  key={u.id}
                  href={u.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block aspect-square rounded-lg overflow-hidden bg-muted relative"
                  title={`${u.name}.${u.format}`}
                >
                  {u.thumb && /jpg|jpeg|png|webp|gif|avif/i.test(u.format) ? (
                    <img
                      src={u.thumb}
                      alt={u.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs uppercase tracking-wide opacity-60">
                      {u.format}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition">
                    {u.name}.{u.format}
                  </div>
                </a>
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
