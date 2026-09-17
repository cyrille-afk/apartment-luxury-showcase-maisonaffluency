import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Check, UploadCloud, FileText } from "lucide-react";
import Turnstile from "@/components/Turnstile";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/bodyScrollLock";
import { cn } from "@/lib/utils";
import PhoneDialField from "@/components/product/PhoneDialField";

/**
 * BespokeConfigurationDialog — the wide, centred overlay opened by the
 * "Request a Bespoke Quote / Customisation" action on the product canvas.
 *
 * Strictly in-canvas: it never routes the visitor to the Trade Account
 * registration page. Submitted specifications are persisted through the
 * concierge inquiry pipeline and seeded into the Felix chat draft.
 */

export interface BespokeConfigurationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productId?: string;
  productTitle?: string | null;
  designerName?: string | null;
  finishLabel?: string | null;
  imageUrl?: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function BespokeConfigurationDialog({
  isOpen,
  onClose,
  productId,
  productTitle = null,
  designerName = null,
  finishLabel = null,
  imageUrl = null,
}: BespokeConfigurationDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [specs, setSpecs] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const targetPiece = [productTitle || "Selected piece", designerName ? `by ${designerName}` : ""]
    .filter(Boolean)
    .join(" ");

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Attachments must be 10 MB or smaller.",
        variant: "destructive",
      });
      return;
    }
    setAttachment(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const submit = async () => {
    if (sending) return;
    if (specs.trim().length < 10) {
      toast({
        title: "Add a few details",
        description: "Describe the finishes, materials or scale you need.",
        variant: "destructive",
      });
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast({ title: "Add a valid email", description: "Our concierge replies there.", variant: "destructive" });
      return;
    }
    setSending(true);

    let attachmentPath: string | undefined;
    if (attachment) {
      try {
        const ext = attachment.name.split(".").pop() || "bin";
        const safeName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        const path = `${productId ?? "general"}/${safeName}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("bespoke-attachments")
          .upload(path, attachment, { cacheControl: "3600", upsert: false });
        if (uploadErr) throw uploadErr;
        attachmentPath = path;
      } catch (err) {
        console.error("Attachment upload failed:", err);
        toast({
          title: "Attachment upload failed",
          description: "Please retry or submit without the file.",
          variant: "destructive",
        });
        setSending(false);
        return;
      }
    }

    const message = [
      `Target piece: ${targetPiece}`,
      finishLabel ? `Current configuration: ${finishLabel}` : "",
      "",
      "Bespoke specifications:",
      specs.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { error } = await supabase.functions.invoke("send-inquiry", {
        body: {
          name: email.split("@")[0] || "Website visitor",
          email: email.trim(),
          phone: phone.trim(),
          message,
          subject: `Bespoke Configuration — ${productTitle ?? "Product"}`,
          productName: productTitle ?? undefined,
          designerName: designerName ?? undefined,
          selectedFinish: finishLabel ?? undefined,
          productId: productId ?? undefined,
          source: "bespoke_configuration",
          attachmentPath,
          turnstileToken: token || undefined,
        },
      });
      if (error) throw error;
      // Push the notes into the Felix concierge chat draft and open it.
      try {
        sessionStorage.setItem("concierge:draft", message);
        sessionStorage.setItem("concierge:open", "1");
        window.dispatchEvent(new Event("concierge:open"));
      } catch {
        /* private mode — the inquiry is already persisted */
      }
      setSent(true);
    } catch (err) {
      console.error("Bespoke specification submission failed:", err);
      toast({
        title: "Could not send your specifications",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div
      className={cn("fixed inset-0 z-[10000]", isOpen ? "pointer-events-auto" : "pointer-events-none")}
      aria-hidden={!isOpen}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-foreground/45 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bespoke configuration details"
          className={cn(
            "relative w-full max-w-3xl border border-border/60 bg-background text-foreground",
            "shadow-[0_40px_90px_-40px_rgba(0,0,0,0.45)] transition-all duration-300 ease-out",
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          )}
        >
          <header className="flex items-center justify-between border-b border-border/60 px-6 py-5 md:px-8">
            <h2 className="font-body text-[10px] font-medium uppercase tracking-[0.22em] text-foreground">
              Bespoke Configuration Details
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </header>

          {sent ? (
            <div className="px-6 py-14 text-center md:px-8">
              <span className="mx-auto mb-5 flex h-11 w-11 items-center justify-center border border-border/60">
                <Check className="h-5 w-5 text-foreground" strokeWidth={1.5} />
              </span>
              <p className="font-display text-xl">Specifications received</p>
              <p className="mx-auto mt-3 max-w-md font-body text-sm leading-relaxed text-muted-foreground">
                Your notes have been sent to our concierge and opened in your Felix conversation. We reply
                within one business day with feasibility, lead time and pricing.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-7 inline-flex h-11 items-center justify-center border border-border/70 px-7 font-body text-[11px] uppercase tracking-[0.18em] transition-colors hover:border-foreground"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="px-6 py-6 md:px-8 md:py-7">
              {/* Locked, read-only context badge */}
              <div className="flex items-center gap-4 border border-border/60 bg-muted/30 px-4 py-3">
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={productTitle || "Selected piece"}
                    className="h-12 w-12 flex-none border border-border/40 bg-cream object-cover"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-body text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                    Target Piece
                  </p>
                  <p className="mt-1 truncate font-body text-sm text-foreground">{targetPiece}</p>
                  {finishLabel && (
                    <p className="mt-0.5 truncate font-body text-[11px] text-muted-foreground">{finishLabel}</p>
                  )}
                </div>
              </div>

              <label className="mt-6 block">
                <span className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Your specifications
                </span>
                <textarea
                  rows={6}
                  value={specs}
                  onChange={(e) => setSpecs(e.target.value)}
                  placeholder="specify custom leather textures, alternative timber finishes, or bespoke structural scale requirements for your project narrative..."
                  className="mt-2 w-full resize-none border border-border/60 bg-background px-4 py-3 font-body text-sm leading-relaxed text-foreground placeholder:font-body placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/40"
                />
              </label>

              {/* Reference material / fabric swatch upload */}
              <div className="mt-5">
                <span className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Attach Reference Material / Fabric Swatch (Optional)
                </span>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  className={cn(
                    "mt-2 flex cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-5 transition-colors",
                    "border-border/60 bg-muted/30 hover:bg-muted/50",
                    isDragging && "border-foreground/40 bg-muted/50"
                  )}
                >
                  <UploadCloud className="h-4 w-4 text-muted-foreground" strokeWidth={1.25} />
                  <p className="mt-2 max-w-md text-center font-body text-xs leading-relaxed text-muted-foreground">
                    drag and drop fabric swatches, grain reference photos, or COM datasheets here, or browse local
                    files (max 10MB)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    className="sr-only"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>

                {attachment && (
                  <div className="mt-3 inline-flex w-full items-center gap-3 border border-border/60 bg-muted/20 px-3 py-2 md:w-auto">
                    <span className="flex h-8 w-8 flex-none items-center justify-center border border-border/50 bg-background">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-body text-xs text-foreground" title={attachment.name}>
                        {attachment.name}
                      </p>
                      <p className="font-body text-[10px] text-muted-foreground">{formatBytes(attachment.size)}</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove attachment"
                      onClick={() => {
                        setAttachment(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="flex h-7 w-7 flex-none items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Email
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@studio.com"
                    className="mt-2 h-11 w-full border border-border/60 bg-background px-3 font-body text-sm focus:outline-none focus:ring-1 focus:ring-foreground/40"
                  />
                </label>
                <label className="block">
                  <span className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Phone <span className="normal-case tracking-normal">(optional)</span>
                  </span>
                  <PhoneDialField value={phone} onChange={setPhone} />
                </label>
              </div>

              <div className="mt-4">
                <Turnstile onVerify={setToken} onExpire={() => setToken("")} />
              </div>

              <div className="mt-6 flex items-center justify-end gap-5 border-t border-border/50 pt-5">
                <button
                  type="button"
                  onClick={onClose}
                  className="font-body text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={sending}
                  className="inline-flex h-12 items-center justify-center gap-2 border border-foreground/70 bg-background px-7 font-body text-[11px] uppercase tracking-[0.18em] text-foreground transition-colors hover:bg-muted/60 disabled:opacity-60"
                >
                  {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  [ Submit Bespoke Specifications ]
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
