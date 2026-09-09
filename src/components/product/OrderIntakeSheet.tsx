import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, ChevronDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/bodyScrollLock";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Turnstile from "@/components/Turnstile";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface OrderIntakeDetails {
  profile: "designer" | "private";
  city: string;
  notes: string;
  email: string;
  phone: string;
  company: string;
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
  submitting?: boolean;
  /**
   * "order" → hands off to the cart / checkout flow.
   * "quote" → submits an inquiry to the backend and shows a thank-you screen
   * inside the drawer. Never routes to the trade account form.
   */
  mode?: "order" | "quote";
  productId?: string | null;
}

const inputCls =
  "h-12 w-full rounded-none border border-border/60 bg-background px-4 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:outline-none transition-colors";
const labelCls =
  "mb-2 block font-body text-[10px] uppercase tracking-widest text-muted-foreground";

const STEPS = ["Intent", "Project", "Contact"] as const;

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
  submitting = false,
  mode = "order",
  productId,
}: Props) {
  const { toast } = useToast();
  const isQuote = mode === "quote";
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<"designer" | "private" | null>(null);
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [notesEdited, setNotesEdited] = useState(false);
  const [finish, setFinish] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);

  // Carry the finish chosen on the product page straight into the sheet so the
  // client never retypes it. The selector opens preselected; changing it keeps
  // untouched notes in sync. Manually edited notes are never overwritten.
  useEffect(() => {
    if (!isOpen) return;
    setFinish(finishLabel ?? null);
    setFinishOpen(false);
    if (!notesEdited) setNotes(finishLabel ? `Selected finish: ${finishLabel}` : "");
  }, [isOpen, finishLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectFinish = (opt: string) => {
    setFinish(opt);
    setFinishOpen(false);
    if (!notesEdited) setNotes(`Selected finish: ${opt}`);
  };

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      lockBodyScroll();
    } else {
      unlockBodyScroll();
      const t = window.setTimeout(() => {
        setMounted(false);
        setStep(0);
        setNotesEdited(false);
        setSent(false);
        setSending(false);
        setTurnstileToken("");
        setCompany("");
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
        : EMAIL_RE.test(email.trim()) && company.trim().length > 0;

  const details = (): OrderIntakeDetails => ({
    profile: profile as "designer" | "private",
    city: city.trim(),
    notes: notes.trim(),
    email: email.trim(),
    phone: phone.trim(),
    company: company.trim(),
  });

  /** Quote flow: persist the inquiry, then show the in-drawer thank-you. */
  const submitQuote = async () => {
    if (sending) return;
    if (!turnstileToken) {
      toast({
        title: "Security check is still loading",
        description: "Please wait a moment, then submit your request again.",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    const d = details();
    const message = [
      productTitle ? `Product: ${productTitle}` : "",
      designerName ? `Designer: ${designerName}` : "",
      finish ? `Selected finish: ${finish}` : "",
      `Company: ${d.company}`,
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
        },
      });
      if (error) throw error;
      setSent(true);
      onComplete(d);
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
    onComplete(details());
  };

  const progress = ((step + (canAdvance ? 1 : 0.35)) / STEPS.length) * 100;

  if (sent) {
    return createPortal(
      <div className="fixed inset-0 z-[130]">
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
            "md:left-1/2 md:right-auto md:w-[440px] md:-translate-x-1/2",
            "transition-transform duration-300 ease-out will-change-transform",
            isOpen ? "translate-y-0" : "translate-y-full"
          )}
        >
          <div className="flex justify-end px-5 pt-4">
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
          <div className="px-5 pb-8 pt-2 text-center">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-border/60">
              <Check className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <p className="font-display text-2xl leading-snug text-foreground">Thank You!</p>
            <p className="mx-auto mt-3 max-w-[19rem] font-body text-sm leading-relaxed text-muted-foreground">
              We have received your quote request and will reply shortly.
            </p>
            {(productTitle || finish) && (
              <p className="mt-4 font-body text-[10px] uppercase tracking-widest text-muted-foreground/80">
                {[productTitle, finish].filter(Boolean).join(" · ")}
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-none bg-foreground px-5 font-body text-xs uppercase tracking-widest text-background transition-transform duration-150 active:scale-[0.98]"
            >
              Close
            </button>
          </div>
          <div className="pb-[env(safe-area-inset-bottom)]" />
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[130] md:items-center md:justify-center">
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-foreground/40 backdrop-blur-[2px] transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Order intake"
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[92svh] flex-col bg-background shadow-[0_-24px_60px_-24px_rgba(0,0,0,0.35)]",
          "md:left-1/2 md:right-auto md:w-[440px] md:-translate-x-1/2",
          "transition-transform duration-300 ease-out will-change-transform",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Razor-thin progress rule */}
        <div className="h-[2px] w-full bg-border/50">
          <div
            className="h-full bg-foreground transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>

        <div className="flex items-center justify-between px-5 pb-3 pt-4">
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
            <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
              Step {step + 1} of 3 · {STEPS[step]}
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {(productTitle || designerName) && (
            <div className="mb-5 border-b border-border/50 pb-4">
              {designerName && (
                <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
                  {designerName}
                </p>
              )}
              {productTitle && (
                <p className="mt-1 font-display text-lg leading-snug text-foreground">{productTitle}</p>
              )}
              {priceLabel && (
                <p className="mt-1 font-body text-xs tracking-wide text-muted-foreground">{priceLabel}</p>
              )}
            </div>
          )}

          {step === 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              <p className="mb-4 font-display text-xl leading-snug text-foreground">
                Are you an Interior Designer / Architect, or a Private Client?
              </p>
              <div className="flex flex-col gap-3">
                {([
                  { key: "designer", label: "Interior Designer / Architect" },
                  { key: "private", label: "Private Client" },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setProfile(opt.key)}
                    className={cn(
                      "flex h-14 w-full items-center justify-between border px-4 font-body text-sm transition-all duration-200",
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
                onChange={(e) => setCity(e.target.value)}
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
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              <p className="mb-4 font-display text-xl leading-snug text-foreground">Where shall we reply?</p>
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                className={inputCls}
              />
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
              <label className={cn(labelCls, "mt-5")} htmlFor="intake-phone">
                Phone Number (optional)
              </label>
              <input
                id="intake-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+65 0000 0000"
                className={inputCls}
              />
              {isQuote && (
                <Turnstile
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken("")}
                  className="mt-5 min-h-[65px]"
                />
              )}
            </div>
          )}
        </div>

        {/* Docked action — stays above the keyboard focus area and the home indicator */}
        <div className="sticky bottom-0 border-t border-neutral-100 bg-white/95 px-5 pt-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
          <button
            type="button"
            onClick={next}
            disabled={!canAdvance || submitting || sending || (isQuote && step === 2 && !turnstileToken)}
            className={cn(
              "mb-3 inline-flex h-12 w-full items-center justify-center rounded-none bg-foreground px-5 font-body text-xs uppercase tracking-widest text-background",
              "transition-transform duration-150 active:scale-[0.98] disabled:opacity-40"
            )}
          >
            {(submitting || sending) && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {step < 2 ? "Next" : isQuote ? "Submit Quote Request" : "Place Order"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
