import { useEffect, useState } from "react";
import {
  X,
  Minus,
  Plus,
  CreditCard,
  Landmark,
  Truck,
  MessageSquare,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

/** Mobile / WhatsApp number: digits, +, spaces, dashes, parentheses — 7–20 chars. */
const PHONE_RE = /^[+0-9][0-9 ()-]{6,19}$/;
const MESSAGE_MAX = 500;

/**
 * SelectionDrawer — the premium "YOUR SELECTION" sliding sidebar.
 *
 * A self-contained luxury mini-cart sheet: sticky header, product row,
 * quantity stepper, payment-method radio cards, concierge trust block and a
 * sticky footer whose primary CTA mutates with the chosen payment method.
 *
 * Scroll is isolated to the body container; the page behind is frozen while
 * open. Scales cleanly from full-width mobile to a 420px desktop sheet.
 */

export type PaymentMethod = "online" | "wire";

export interface SelectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Brand / designer, e.g. "Dagmar" */
  brand?: string | null;
  /** Piece title, e.g. "Clam Chair, 1944" */
  title?: string | null;
  /** Configuration line, e.g. "Oiled Walnut / Sheepskin SKANDILOCK – 09 Moonlight" */
  configuration?: string | null;
  /** e.g. "10–14 weeks" */
  leadTime?: string | null;
  /** Fully formatted price line, e.g. "From $7,513" or "Price upon Request" */
  priceLabel?: string | null;
  imageUrl?: string | null;
  quantity?: number;
  onQuantityChange?: (q: number) => void;
  /** Fired by the sticky footer CTA with the selected payment method */
  onCheckout?: (method: PaymentMethod) => void;
  placing?: boolean;
}

export default function SelectionDrawer({
  isOpen,
  onClose,
  brand = null,
  title = null,
  configuration = null,
  leadTime = null,
  priceLabel = null,
  imageUrl = null,
  quantity: quantityProp,
  onQuantityChange,
  onCheckout,
  placing = false,
}: SelectionDrawerProps) {
  const [method, setMethod] = useState<PaymentMethod>("online");
  const [localQty, setLocalQty] = useState(1);
  // Inline concierge widget state — replaces the trust block when engaged.
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [conciergePhone, setConciergePhone] = useState("");
  const [conciergeMessage, setConciergeMessage] = useState("");
  const [conciergeError, setConciergeError] = useState<string | null>(null);
  const [conciergeSending, setConciergeSending] = useState(false);
  const [conciergeSent, setConciergeSent] = useState(false);
  const quantity = quantityProp ?? localQty;
  const setQuantity = (q: number) => {
    setLocalQty(q);
    onQuantityChange?.(q);
  };

  const sendConciergeText = async () => {
    const phone = conciergePhone.trim();
    const message = conciergeMessage.trim();
    if (!PHONE_RE.test(phone)) {
      setConciergeError("Enter a valid mobile / WhatsApp number (7–20 digits, + allowed).");
      return;
    }
    if (message.length < 3) {
      setConciergeError("Add a short message so our concierge knows how to help.");
      return;
    }
    if (message.length > MESSAGE_MAX) {
      setConciergeError(`Keep the message under ${MESSAGE_MAX} characters.`);
      return;
    }
    setConciergeError(null);
    setConciergeSending(true);
    try {
      const sessionId =
        sessionStorage.getItem("ma_concierge_session") ??
        (() => {
          const id = crypto.randomUUID();
          sessionStorage.setItem("ma_concierge_session", id);
          return id;
        })();
      const { error } = await supabase.functions.invoke("concierge-text-request", {
        body: {
          phone,
          message,
          session_id: sessionId,
          product: [brand, title].filter(Boolean).join(" — ") || null,
          configuration: configuration ?? null,
          path: window.location.pathname.slice(0, 500),
          referrer: document.referrer ? document.referrer.slice(0, 500) : null,
        },
      });
      if (error) throw error;
      setConciergeSent(true);
    } catch {
      setConciergeError("Could not send right now — please try again in a moment.");
    } finally {
      setConciergeSending(false);
    }
  };

  // Freeze the page behind the sheet while it is open (ref-counted so
  // overlapping overlays can never strand the page in a locked state).
  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isOpen]);


  // Escape closes — standard luxury-sheet behaviour.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[10000]",
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-foreground/40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Panel — slides right-to-left */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your selection"
        className={cn(
          "absolute right-0 top-0 h-full w-full max-w-[420px]",
          "flex flex-col bg-background text-foreground border-l border-border/60",
          "shadow-[-24px_0_60px_-30px_rgba(0,0,0,0.25)]",
          "transition-transform duration-300 ease-out will-change-transform",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* ── 1 · Sticky header ─────────────────────────────────────────── */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/60 px-6">
          <h2 className="font-body text-[10px] font-medium uppercase tracking-widest text-foreground">
            Your Selection
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </header>

        {/* ── Scrollable body — scroll is isolated here ─────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
          {/* 2 · Product info row */}
          <div className="flex gap-4">
            {imageUrl && (
              <img
                src={imageUrl}
                alt={title || "Selected piece"}
                className="h-24 w-24 flex-none border border-border/40 bg-cream object-cover"
                loading="lazy"
              />
            )}
            <div className="min-w-0 flex-1">
              {brand && (
                <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
                  {brand}
                </p>
              )}
              {title && (
                <p className="mt-1 font-display text-base leading-snug text-foreground">
                  {title}
                </p>
              )}
              {configuration && (
                <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
                  {configuration}
                </p>
              )}
              {leadTime && (
                <p className="mt-1.5 font-body text-[11px] text-muted-foreground/80">
                  Lead time: {leadTime}
                </p>
              )}
              {priceLabel && (
                <p className="mt-2 font-body text-sm font-medium text-foreground">
                  {priceLabel}
                </p>
              )}
            </div>
          </div>

          {/* 3 · Quantity control row */}
          <div className="mt-7 flex items-center justify-between">
            <span className="font-body text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Quantity
            </span>
            <div className="flex h-10 w-32 items-center justify-between border border-border/60">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-full w-10 items-center justify-center text-foreground transition-colors hover:bg-muted/50 disabled:opacity-30"
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
              <span className="min-w-8 text-center font-body text-sm tabular-nums text-foreground">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQuantity(Math.min(99, quantity + 1))}
                className="flex h-full w-10 items-center justify-center text-foreground transition-colors hover:bg-muted/50"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <div className="my-6 h-px bg-border/50" />

          {/* 4 · Payment method selector */}
          <p className="font-body text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Payment Method
          </p>
          {/* Section labels share one style token with QUANTITY + YOUR SELECTION. */}
          <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="Payment method">
            <PaymentOption
              active={method === "online"}
              onSelect={() => setMethod("online")}
              icon={<CreditCard className="h-4 w-4" strokeWidth={1.5} />}
              label="Pay Securely Online"
              subtext="Credit Card, Google Pay, Apple Pay"
            />
            <PaymentOption
              active={method === "wire"}
              onSelect={() => setMethod("wire")}
              icon={<Landmark className="h-4 w-4" strokeWidth={1.5} />}
              label="Bank Wire Transfer"
              subtext="Preferred for Trade & Corporate Accounts"
            />
          </div>

          {/* 5 · Trust & concierge block — swaps for the inline contact widget */}
          <div className="mt-6 border border-border/50 bg-cream px-4 py-4">
            {!conciergeOpen ? (
              <>
                <div className="flex gap-3">
                  <Truck className="mt-0.5 h-4 w-4 flex-none text-foreground/70" strokeWidth={1.5} />
                  <p className="font-body text-[11px] leading-relaxed text-muted-foreground">
                    Premium white-glove delivery &amp; professional installation will be calculated and
                    quoted by your advisor post-purchase.
                  </p>
                </div>
                <div className="mt-3 flex gap-3">
                  <MessageSquare className="mt-0.5 h-4 w-4 flex-none text-foreground/70" strokeWidth={1.5} />
                  <p className="font-body text-[11px] leading-relaxed text-muted-foreground">
                    Need assistance with luxury card limits?{" "}
                    <button
                      type="button"
                      onClick={() => setConciergeOpen(true)}
                      className="text-foreground underline underline-offset-4 decoration-border transition-colors hover:decoration-foreground"
                    >
                      Text our private concierge instantly
                    </button>
                    .
                  </p>
                </div>
              </>
            ) : conciergeSent ? (
              <div className="flex gap-3">
                <MessageSquare className="mt-0.5 h-4 w-4 flex-none text-foreground/70" strokeWidth={1.5} />
                <p className="font-body text-[11px] leading-relaxed text-muted-foreground">
                  Message sent — our private concierge will text you back shortly on the number provided.
                </p>
              </div>
            ) : (
              <div>
                <p className="font-body text-[10px] font-medium uppercase tracking-widest text-foreground">
                  Text our private concierge
                </p>
                <label className="mt-3 block">
                  <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
                    Mobile / WhatsApp Number
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={20}
                    value={conciergePhone}
                    onChange={(e) => setConciergePhone(e.target.value)}
                    placeholder="+65 9123 4567"
                    className="mt-1 h-10 w-full border border-border/60 bg-background px-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/40"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
                    Your Message
                  </span>
                  <textarea
                    rows={2}
                    maxLength={MESSAGE_MAX}
                    value={conciergeMessage}
                    onChange={(e) => setConciergeMessage(e.target.value)}
                    placeholder="e.g. Questions on payment limits or delivery timing…"
                    className="mt-1 w-full resize-none border border-border/60 bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/40"
                  />
                </label>
                {conciergeError && (
                  <p className="mt-2 font-body text-[11px] text-destructive">{conciergeError}</p>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={sendConciergeText}
                    disabled={conciergeSending}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 bg-foreground px-4 font-body text-[10px] font-medium uppercase tracking-widest text-background transition-all hover:bg-foreground/85 disabled:opacity-60"
                  >
                    <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {conciergeSending ? "Sending…" : "Send Text"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConciergeOpen(false);
                      setConciergeError(null);
                    }}
                    className="font-body text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 6 · Sticky footer actions ──────────────────────────────────── */}
        <footer className="shrink-0 border-t border-border/60 px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => onCheckout?.(method)}
            disabled={placing}
            className="inline-flex h-12 w-full items-center justify-center bg-foreground px-5 font-body text-xs font-medium uppercase tracking-widest text-background transition-all hover:bg-foreground/85 disabled:opacity-60"
          >
            {placing
              ? "Opening checkout…"
              : method === "online"
                ? "Go to Checkout"
                : "Proceed to Wire Instructions"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full text-center font-body text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            Continue Browsing
          </button>
        </footer>
      </aside>
    </div>
  );
}

/** 4 · A single selectable payment row — crisp radio-card behaviour. */
function PaymentOption({
  active,
  onSelect,
  icon,
  label,
  subtext,
}: {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  subtext: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 border px-4 py-3.5 text-left transition-colors duration-150",
        active
          ? "border-foreground bg-background"
          : "border-border/70 bg-transparent hover:border-border"
      )}
    >
      {/* Sharp square selector marker — matches the square buttons/counters. */}
      <span
        className={cn(
          "flex h-4 w-4 flex-none items-center justify-center border transition-colors",
          active ? "border-foreground" : "border-border"
        )}
      >
        <span
          className={cn(
            "h-2 w-2 transition-colors",
            active ? "bg-foreground" : "bg-transparent"
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-xs font-medium text-foreground">
          {label}
        </span>
        <span className="mt-0.5 block font-body text-[10px] leading-relaxed text-muted-foreground">
          {subtext}
        </span>
      </span>
      <span className={cn("flex-none", active ? "text-foreground" : "text-muted-foreground/60")}>
        {icon}
      </span>
    </button>
  );
}
