import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/bodyScrollLock";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Turnstile from "@/components/Turnstile";
import { useCheckoutForm } from "@/contexts/CheckoutFormContext";
import { getCurrentDestination } from "@/lib/shippingDestination";
import PhoneDialField from "@/components/product/PhoneDialField";
import { pushBespokeSync } from "@/lib/bespokeSync";
import { cachePendingBespokeUpload } from "@/lib/pendingBespokeCache";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface OrderIntakeDetails {
  profile: "designer" | "private";
  city: string;
  notes: string;
  email: string;
  phone: string;
  company: string;
  buyerType?: "individual" | "business";
  attachment?: File | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Fired once the third step is completed. */
  onComplete: (details: OrderIntakeDetails) => void;
  productTitle?: string | null;
  designerName?: string | null;
  priceLabel?: string | null;
  /** Finish / configuration chosen on the product page — prefilled into notes. */
  finishLabel?: string | null;
  /** Every selectable finish for the product — enables the inline finish selector. */
  finishOptions?: string[];
  /** Per-finish price label + image, used to re-price / re-image the preview live. */
  finishVariants?: { label: string; priceLabel?: string | null; imageUrl?: string | null }[];
  /** Product hero image — fallback when the chosen finish has no dedicated asset. */
  baseImageUrl?: string | null;
  submitting?: boolean;
  /**
   * "order" → hands off to the cart / checkout flow.
   * "quote" → submits an inquiry to the backend and shows a thank-you screen
   * inside the drawer. Never routes to the trade account form.
   */
  mode?: "order" | "quote";
  productId?: string | null;
  /** Overrides the last step's action label (e.g. "Continue"). */
  finalLabel?: string;
  isTradeAuthorized?: boolean;
  showAttachmentDropzone?: boolean;
}

const inputCls =
  "h-12 w-full rounded-none border border-border/60 bg-background px-4 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:outline-none transition-colors";
const labelCls =
  "mb-2 block font-body text-[10px] uppercase tracking-widest text-muted-foreground";

const STEPS = ["Intent", "Project", "Contact"] as const;
const EmbeddedFelixChat = lazy(() =>
  import("@/components/trade/AIConcierge").then((module) => ({ default: module.AIConcierge })),
);

/**
 * Mobile-first 3-step order intake bottom sheet.
 *
 * Replaces the abrupt full-screen checkout hand-off with a conversational
 * drawer: intent profile → project context → contact detail. A razor-thin
 * progress rule fills across the top, and the primary action stays docked
 * above the keyboard / home indicator via safe-area padding.
 */
export default function OrderIntakeSheet({
  isOpen,
  onClose,
  onComplete,
  productTitle,
  designerName,
  priceLabel,
  finishLabel,
  finishOptions,
  finishVariants,
  baseImageUrl,
  submitting = false,
  mode = "order",
  productId,
  finalLabel,
  isTradeAuthorized = false,
  showAttachmentDropzone = false,
}: Props) {
  const { toast, dismiss } = useToast();
  const checkoutForm = useCheckoutForm();
  const isQuote = mode === "quote";
  const shouldShowAttachmentDropzone = isQuote || showAttachmentDropzone;
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showingSuccess, setShowingSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<"designer" | "private" | null>(
    checkoutForm.buyerProfile,
  );
  const [city, setCity] = useState(checkoutForm.projectCity);
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [buyerType, setBuyerType] = useState<"individual" | "business">("individual");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [notesEdited, setNotesEdited] = useState(false);
  const [finish, setFinish] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carry the finish chosen on the product page straight into the sheet so the
  // client never retypes it. The selector opens preselected; changing it keeps
  // untouched notes in sync. Manually edited notes are never overwritten.
  useEffect(() => {
    if (!isOpen) return;
    setFinish(finishLabel ?? null);
    setFinishOpen(false);
    setEmail((current) => current || checkoutForm.email);
    // Project profile + location are global: stated once, pre-filled forever.
    setProfile((current) => current ?? checkoutForm.buyerProfile);
    setCity((current) => current || checkoutForm.projectCity);
    if (!notesEdited) setNotes(finishLabel ? `Selected finish: ${finishLabel}` : "");
  }, [isOpen, finishLabel, checkoutForm.email]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Studio vs private client — written straight into global state. */
  const chooseProfile = (next: "designer" | "private") => {
    setProfile(next);
    checkoutForm.setBuyerProfile(next);
  };

  /** Project location is sticky across the whole funnel. */
  const changeCity = (next: string) => {
    setCity(next);
    checkoutForm.setProjectCity(next.trim());
    if (!checkoutForm.projectCountry) {
      const iso = getCurrentDestination()?.iso;
      if (iso) checkoutForm.setProjectCountry(iso);
    }
  };

  const selectFinish = (opt: string) => {
    setFinish(opt);
    setFinishOpen(false);
    if (!notesEdited) setNotes(`Selected finish: ${opt}`);
  };

  // Live variant resolution: the chosen finish drives both the displayed price
  // and the preview image. Missing assets degrade to the hero shot + caption.
  const activeVariant =
    (finishVariants || []).find(
      (v) => v.label.trim().toLowerCase() === (finish || "").trim().toLowerCase(),
    ) || null;
  const activePriceLabel = activeVariant?.priceLabel || priceLabel || null;
  const previewImage = activeVariant?.imageUrl || baseImageUrl || null;
  const usingFallbackImage = Boolean(previewImage) && !activeVariant?.imageUrl && Boolean(finish);

  useEffect(() => {
    if (isOpen) {
      // Clear any confirmation retained by the legacy header-notice flow.
      dismiss();
      setMounted(true);
      lockBodyScroll();
    } else {
      unlockBodyScroll();
      const t = window.setTimeout(() => {
        setMounted(false);
        setStep(0);
        setNotesEdited(false);
        setSent(false);
        setShowingSuccess(false);
        setSending(false);
        setTurnstileToken("");
        setCompany("");
        setBuyerType("individual");
        setAttachment(null);
        setIsDragging(false);
      }, 320);
      return () => window.clearTimeout(t);
    }
    return () => unlockBodyScroll();
  }, [isOpen]);

  if (!mounted && !isOpen) return null;

  const canAdvance =
    step === 0
      ? Boolean(profile)
      : step === 1
        ? city.trim().length > 1
        : EMAIL_RE.test(email.trim()) &&
          (buyerType === "individual" || company.trim().length > 0);

  const details = (): OrderIntakeDetails => ({
    profile: profile as "designer" | "private",
    city: city.trim(),
    notes: notes.trim(),
    email: email.trim(),
    phone: phone.trim(),
    company: buyerType === "business" ? company.trim() : "",
    buyerType,
    attachment,
  });

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Attachments must be 10 MB or smaller.", variant: "destructive" });
      return;
    }
    setAttachment(file);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /** Quote flow: persist the inquiry, then show the in-drawer thank-you. */
  const submitQuote = async () => {
    if (sending) return;
    if (!isTradeAuthorized && !turnstileToken) {
      toast({
        title: "Security check is still loading",
        description: "Please wait a moment, then submit your request again.",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    const d = details();
    let attachmentPath: string | undefined;
    if (attachment) {
      try {
        const ext = attachment.name.split(".").pop() || "bin";
        const path = `${productId ?? "general"}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("bespoke-attachments")
          .upload(path, attachment, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        attachmentPath = path;
      } catch (error) {
        console.error("Reference upload failed:", error);
        toast({ title: "Attachment upload failed", description: "Please retry or submit without the file.", variant: "destructive" });
        setSending(false);
        return;
      }
    }
    const message = [
      productTitle ? `Product: ${productTitle}` : "",
      designerName ? `Designer: ${designerName}` : "",
      finish ? `Selected finish: ${finish}` : "",
      `Buyer type: ${d.buyerType === "business" ? "Business / Studio" : "Individual / Private Buyer"}`,
      d.buyerType === "business" && d.company ? `Company: ${d.company}` : "",
      `Client type: ${d.profile === "designer" ? "Interior Designer / Architect" : "Private Client"}`,
      d.city ? `Project location: ${d.city}` : "",
      d.phone ? `Phone: ${d.phone}` : "",
      "",
      d.notes || "Quote requested from the product page.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { error } = await supabase.functions.invoke("send-inquiry", {
        body: {
          name: d.email.split("@")[0] || "Website visitor",
          email: d.email,
          phone: d.phone,
          company: d.company,
          message,
          subject: `Quote Request — ${productTitle ?? "Product"}`,
          productName: productTitle ?? undefined,
          designerName: designerName ?? undefined,
           selectedFinish: finish ?? undefined,
          productId: productId ?? undefined,
          source: "public_product",
           turnstileToken,
           attachmentPath,
        },
      });
      if (error) throw error;
      const syncEntry = {
        productId: productId ?? undefined,
        productTitle: productTitle ?? "Selected piece",
        designerName,
        finishLabel: finish,
        specs: d.notes || "Bespoke specifications requested.",
        attachmentName: attachment?.name ?? null,
        attachmentPath: attachmentPath ?? null,
        projectLocation: d.city,
        submittedAt: new Date().toISOString(),
      };
      if (isTradeAuthorized) pushBespokeSync(syncEntry);
      else cachePendingBespokeUpload(syncEntry);
      dismiss();
      onComplete(d);
      // Keep the drawer anchored while Step 3 fades away, then reveal the
      // persistent success canvas in the same bounds.
      setShowingSuccess(true);
      window.setTimeout(() => setSent(true), 250);
    } catch (error) {
      let responseBody: string | undefined;
      if (error && typeof error === "object" && "context" in error) {
        const context = (error as { context?: unknown }).context;
        if (context instanceof Response) {
          try {
            responseBody = await context.clone().text();
          } catch {
            responseBody = undefined;
          }
        }
      }
      console.error("Quote request submission failed:", { error, responseBody });
      toast({
        title: "Could not send your request",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const next = () => {
    if (!canAdvance) return;
    if (step < 2) {
      setStep((s) => s + 1);
      return;
    }
    if (isQuote) {
      void submitQuote();
      return;
    }
    const confirmedDetails = details();
    checkoutForm.setEmail(confirmedDetails.email);
    checkoutForm.update({
      projectCity: confirmedDetails.city,
      buyerProfile: confirmedDetails.profile,
    });
    onComplete(confirmedDetails);
  };

  const progress = ((step + (canAdvance ? 1 : 0.35)) / STEPS.length) * 100;
  const attachmentDropzone = shouldShowAttachmentDropzone ? (
    <div className="mt-6">
      <span className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Attach Reference Material / Fabric Swatch (Optional)
      </span>
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
        className={cn(
          "mt-2 flex cursor-pointer flex-col items-center justify-center border border-dashed border-border/60 bg-muted/30 px-6 py-6 transition-colors hover:bg-muted/50",
          isDragging && "border-foreground/40 bg-muted/50",
        )}
      >
        <UploadCloud className="h-4 w-4 text-muted-foreground" strokeWidth={1.25} />
        <p className="mt-2 text-center font-body text-xs leading-relaxed text-muted-foreground">
          drag and drop fabric swatches, grain reference photos, or COM datasheets here, or browse local files (max 10MB)
        </p>
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx" className="sr-only" onChange={(event) => handleFiles(event.target.files)} />
      </div>
      {attachment && (
        <div className="mt-3 flex items-center gap-3 border border-border/60 bg-muted/20 px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-border/50 bg-background">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-body text-xs text-foreground">{attachment.name}</p>
            <p className="font-body text-[10px] text-muted-foreground">{formatBytes(attachment.size)}</p>
          </div>
          <button type="button" aria-label="Remove attachment" onClick={() => setAttachment(null)} className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  ) : null;

  if (sent) {
    return createPortal(
      // h-[100dvh]: on iOS Safari `inset-0` resolves to the layout viewport
      // (toolbars retracted), pinning bottom-0 children behind the browser
      // chrome. dvh tracks the live visual viewport so the sheet's docked
      // action is always reachable.
      <div className="fixed inset-0 z-[10001] h-[100dvh]">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={cn(
            "absolute inset-0 bg-foreground/40 backdrop-blur-[2px] transition-opacity duration-300",
            isOpen ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quote request sent"
          className={cn(
            "absolute inset-x-0 bottom-0 flex flex-col bg-background shadow-[0_-24px_60px_-24px_rgba(0,0,0,0.35)]",
            "md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[500px] md:border-l md:border-border/60",
            "transition-transform duration-300 ease-out will-change-transform",
            isOpen ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"
          )}
        >
           <div className="flex justify-end px-5 pt-4 md:px-8 md:pt-6">
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
           {isTradeAuthorized ? (
             <Suspense
               fallback={
                 <div className="flex min-h-0 flex-1 items-center justify-center" aria-label="Opening Felix workspace">
                   <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                 </div>
               }
             >
               <EmbeddedFelixChat embedded onEmbeddedClose={onClose} />
             </Suspense>
           ) : <div className="relative flex min-h-0 flex-1 animate-in flex-col items-center justify-center fade-in px-7 pb-24 text-center duration-300 md:px-12">
             <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/45 text-primary">
               <Check className="h-5 w-5" strokeWidth={1.4} />
             </div>
             <p className="mt-7 font-body text-[11px] font-medium uppercase tracking-[0.22em] text-foreground">
               Specifications Recorded
             </p>
             <p className="mx-auto mt-6 max-w-sm font-body text-sm leading-7 text-muted-foreground">
                Our Concierge desk has successfully registered your configuration and material parameters for the Aragon Coffee Table, 1928. A formal project proposal and logistics brief are being compiled by our Paris atelier and will be transmitted directly to your priority studio inbox.
             </p>
             <Button
               type="button"
               onClick={onClose}
               className="mt-10 h-12 w-full max-w-sm rounded-none font-body text-[10px] uppercase tracking-[0.18em]"
             >
               [ Close Workspace Drawer ]
             </Button>
             <Link
               to="/trade-program"
               onClick={onClose}
               className="absolute inset-x-6 bottom-8 font-body text-[10px] lowercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
             >
               [ apply for the trade program to track project timelines in real-time ]
             </Link>
           </div>}
          <div className="pb-[env(safe-area-inset-bottom)]" />
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    // Full-viewport overlay: covers the global header so the modal reads as an
    // independent surface. Geometry is self-contained (no product-page inputs).
    <div className="fixed inset-0 left-0 top-0 z-[10001] h-[100dvh] w-full">

      {/* Scrim */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-foreground/40 backdrop-blur-[2px] transition-opacity duration-300 md:bg-foreground/10 md:backdrop-blur-none",
          isOpen ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Sheet */}
       <div
        role="dialog"
        aria-modal="true"
        aria-label="Order intake"
        className={cn(
          "absolute inset-0 flex h-full w-full flex-col overflow-y-auto bg-background shadow-[0_-24px_60px_-24px_rgba(0,0,0,0.35)]",
          "md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[500px] md:border-l md:border-border/60 md:shadow-[0_0_50px_-30px_hsl(var(--foreground)/0.22)]",
          "transition-transform duration-300 ease-out will-change-transform",
          isOpen ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"
        )}
      >
        <div className={cn("flex min-h-0 flex-1 flex-col transition-opacity duration-[250ms] ease-in-out", showingSuccess && "opacity-0")}>
        {/* Razor-thin progress rule */}
        <div className="h-[2px] w-full bg-border/50">
          <div
            className="h-full bg-foreground transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>

        <div className="flex shrink-0 items-center justify-between px-6 pb-3 pt-4 md:px-8 md:pt-6">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                aria-label="Back"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="-ml-1 flex h-8 w-8 items-center justify-center text-foreground"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              </button>
            )}
            <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground md:hidden">
              Step {step + 1} of 3 · {STEPS[step]}
            </span>
            <span className="hidden font-body text-[10px] uppercase tracking-[0.18em] text-foreground md:inline">
              Quote &amp; Order Workspace
            </span>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-muted-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-8 md:pb-8 md:pt-2">
          {(productTitle || designerName) && (
            <div className="mb-5 border-b border-border/50 pb-5 short:mb-3 short:pb-2">
              <p className="font-body text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Target Piece</p>
              <p className="mt-1 font-display text-lg leading-snug text-foreground">
                {[productTitle, designerName ? `by ${designerName}` : ""].filter(Boolean).join(" ")}
              </p>
              {activePriceLabel && (
                <p className="mt-1 font-body text-xs tracking-wide text-muted-foreground transition-opacity duration-200">
                  {activePriceLabel}
                </p>
              )}
              {previewImage && (
                <div className="mt-3 md:hidden short:mt-2">
                  <div className="overflow-hidden bg-muted/30">
                    <img
                      key={previewImage}
                      src={previewImage}
                      alt={[productTitle, finish].filter(Boolean).join(" — ") || "Product"}
                      loading="lazy"
                      className="h-auto w-full object-contain animate-in fade-in duration-300"
                    />
                  </div>
                  {usingFallbackImage && (
                    <p className="mt-1.5 font-body text-[10px] italic tracking-wide text-muted-foreground/70">
                      Custom finish selection shown.
                    </p>
                  )}
                </div>
              )}
              <div className="mt-5 hidden grid-cols-3 border-y border-border/50 py-3 md:grid">
                {(["Profile", "Context", "Contact"] as const).map((label, index) => (
                  <div key={label} className={cn("font-body text-[9px] uppercase tracking-[0.16em]", index <= step ? "text-foreground" : "text-muted-foreground/45")}>
                    <span className="mr-1.5 tabular-nums">0{index + 1}</span>{label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              <p className="mb-4 font-display text-xl leading-snug text-foreground short:mb-3">
                Are you an Interior Designer / Architect, or a Private Client?
              </p>
              <div className="flex flex-col gap-3 md:grid md:grid-cols-2 short:gap-2">
                {([
                  { key: "designer", label: "Interior Designer / Architect" },
                  { key: "private", label: "Private Client" },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => chooseProfile(opt.key)}
                    className={cn(
                      "flex min-h-14 w-full items-center justify-between border px-4 py-4 text-left font-body text-sm transition-all duration-200 md:min-h-28 md:flex-col md:items-start md:justify-between",
                      profile === opt.key
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/60 bg-background text-foreground hover:border-foreground/50"
                    )}
                  >
                    <span>{opt.label}</span>
                    {profile === opt.key && <Check className="h-4 w-4" strokeWidth={1.75} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              <p className="mb-4 font-display text-xl leading-snug text-foreground">Your project context</p>
              <label className={labelCls} htmlFor="intake-city">
                Project Location (City)
              </label>
              <input
                id="intake-city"
                autoFocus
                value={city}
                onChange={(e) => changeCity(e.target.value)}
                placeholder="e.g., Singapore"
                className={inputCls}
              />
              <label className={cn(labelCls, "mt-5")} htmlFor="intake-notes">
                Requested Material Finish / Customization notes
              </label>
              {finishOptions && finishOptions.length > 0 ? (
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => setFinishOpen((o) => !o)}
                    aria-expanded={finishOpen}
                    className="flex h-12 w-full items-center justify-between border border-border/60 bg-background px-4 font-body text-sm text-foreground transition-colors focus:border-foreground focus:outline-none"
                  >
                    <span className={cn("truncate", !finish && "text-muted-foreground/50")}>
                      {finish || "Select a finish"}
                    </span>
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", finishOpen && "rotate-180")}
                      strokeWidth={1.5}
                    />
                  </button>
                  {finishOpen && (
                    <div className="mt-1 max-h-56 overflow-y-auto border border-border/60 bg-background shadow-[0_16px_40px_-20px_rgba(0,0,0,0.35)] animate-in fade-in slide-in-from-top-1 duration-200">
                      {finishOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => selectFinish(opt)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-body text-sm transition-colors",
                            finish === opt
                              ? "bg-muted/60 text-foreground"
                              : "text-foreground/80 hover:bg-muted/40"
                          )}
                        >
                          <span className="leading-snug">{opt}</span>
                          {finish === opt && <Check className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : finish ? (
                <p className="mb-2 inline-flex items-center gap-2 border border-border/60 px-3 py-1.5 font-body text-[11px] tracking-wide text-foreground">
                  <Check className="h-3 w-3" strokeWidth={1.75} />
                  {finish}
                </p>
              ) : null}
              <textarea
                id="intake-notes"
                value={notes}
                onChange={(e) => {
                  setNotesEdited(true);
                  setNotes(e.target.value);
                }}
                rows={4}
                placeholder="Optional — finishes, dimensions, timeline"
                className={cn(inputCls, "h-auto py-3 leading-relaxed")}
              />
              {attachmentDropzone}
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              <p className="mb-4 font-display text-xl leading-snug text-foreground">Where shall we reply?</p>

              <label className={cn(labelCls, "mb-3")} htmlFor="intake-buying-for-company">
                I am an interior designer, architect, or buying on behalf of a company.
              </label>
              <button
                id="intake-buying-for-company"
                type="button"
                role="checkbox"
                aria-checked={buyerType === "business"}
                onClick={() => setBuyerType((t) => (t === "business" ? "individual" : "business"))}
                className={cn(
                  "mb-5 flex h-12 w-full items-center gap-3 border px-4 font-body text-xs transition-all duration-200",
                  buyerType === "business"
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/60 bg-background text-foreground hover:border-foreground/50"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center border transition-colors",
                    buyerType === "business" ? "border-background bg-background text-foreground" : "border-current bg-transparent"
                  )}
                >
                  {buyerType === "business" && <Check className="h-3 w-3" strokeWidth={2} />}
                </span>
                <span>Business / studio purchase</span>
              </button>

              <label className={labelCls} htmlFor="intake-email">
                Email Address
              </label>
              <input
                id="intake-email"
                autoFocus
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  checkoutForm.setEmail(e.target.value);
                }}
                placeholder="you@studio.com"
                className={inputCls}
              />
              {buyerType === "business" && (
                <>
                  <label className={cn(labelCls, "mt-5")} htmlFor="intake-company">
                    Company / Studio Name
                  </label>
                  <input
                    id="intake-company"
                    type="text"
                    autoComplete="organization"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Your studio or company"
                    className={inputCls}
                  />
                </>
              )}
              <label className={cn(labelCls, "mt-5")} htmlFor="intake-phone">
                Phone Number (optional)
              </label>
              <PhoneDialField value={phone} onChange={setPhone} />
              {isQuote && (
                <Turnstile
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken("")}
                  className={cn("mt-5 min-h-[65px]", isTradeAuthorized && "hidden")}
                />
              )}
            </div>
          )}
        </div>

        {/* Natural-flow mobile action; desktop retains its docked sheet action. */}
        {/* Mobile: button flows with the content. Desktop keeps its docked action. */}
         <div className="px-6 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-0 md:sticky md:bottom-0 md:mt-auto md:shrink-0 md:border-t md:border-border/50 md:bg-background/95 md:px-8 md:pb-5 md:pt-5 md:backdrop-blur-md">
          <button
            type="button"
            onClick={next}
            disabled={!canAdvance || submitting || sending || (isQuote && !isTradeAuthorized && step === 2 && !turnstileToken)}
            className={cn(
              "mt-6 inline-flex w-full items-center justify-center rounded-none bg-foreground px-5 py-4 font-body text-xs uppercase tracking-widest text-background md:mb-3 md:mt-0 md:h-12 md:py-0",
              "transition-transform duration-150 active:scale-[0.98] disabled:opacity-40"
            )}
          >
            {(submitting || sending) && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {step < 2 ? "Next" : finalLabel ?? (isQuote ? "Submit Quote Request" : "Place Order")}
          </button>
        </div>
         </div>
      </div>
    </div>,
    document.body
  );
}
