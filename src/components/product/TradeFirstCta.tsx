import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type Audience = "trade" | "retail";

export interface TradeFirstCtaProps {
  /** Path to return to after trade sign-in */
  redirectTo?: string;
  /** Formatted public retail price, e.g. "From $33,000" */
  rrpLabel?: string | null;
  /** Opens the enquiry / quote dialog */
  onRequestQuote: () => void;
  /** When true the visitor is already authenticated — tabs are hidden */
  signedIn?: boolean;
  className?: string;
}

/**
 * Trade-first CTA block.
 *
 * A minimal segmented control ("Trade" active by default, "Retail" second)
 * sitting at the top of the pricing section. Each tab reveals a single
 * primary action, with quiet secondary routes underneath — no coloured
 * blocks, thin borders and generous white space only.
 */
export default function TradeFirstCta({
  redirectTo,
  rrpLabel,
  onRequestQuote,
  signedIn = false,
  className,
}: TradeFirstCtaProps) {
  const [audience, setAudience] = useState<Audience>("trade");

  const q = new URLSearchParams();
  if (redirectTo) q.set("redirect", redirectTo);
  const loginHref = `/trade/login${q.toString() ? `?${q.toString()}` : ""}`;

  // Clean, sharp, border-based button system — 0px corners, thin 1px rules,
  // uppercase micro-tracking. Semantic tokens only (dark-mode safe).
  const primaryBtn =
    "inline-flex h-12 w-full items-center justify-center px-5 rounded-[2px] bg-foreground text-background font-body text-[11px] font-medium leading-none uppercase tracking-[0.2em] hover:bg-foreground/85 transition-colors";

  const secondaryBtn =
    "inline-flex h-12 w-full items-center justify-center px-5 rounded-[2px] bg-background text-foreground border border-foreground font-body text-[11px] font-medium leading-none uppercase tracking-[0.2em] hover:bg-muted/60 transition-colors";

  if (signedIn) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <button type="button" onClick={onRequestQuote} className={primaryBtn}>
          Inquire to Purchase
        </button>
        {secureNote}
      </div>
    );
  }

  const tabBase =
    "flex-1 py-2.5 font-body text-[10px] uppercase tracking-[0.2em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* Segmented audience control */}
      <div
        role="tablist"
        aria-label="Pricing audience"
        className="flex border-b border-border/70"
      >
        {(["trade", "retail"] as Audience[]).map((key) => {
          const active = audience === key;
          return (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setAudience(key)}
              className={cn(
                tabBase,
                active
                  ? "text-foreground bg-background border-b border-foreground -mb-px"
                  : "text-muted-foreground/80 bg-muted/50 hover:bg-muted/70 hover:text-foreground",
              )}
            >
              {key === "trade" ? "Trade" : "Retail"}
            </button>
          );
        })}
      </div>


      {audience === "trade" ? (
        <div className="flex flex-col gap-3">
          <p className="font-body text-[11px] leading-relaxed text-muted-foreground">
            Trade pricing, client management tools and AI curatorial guide are
            for registered design professionals.
          </p>

          <Link to={loginHref} className={primaryBtn}>
            Sign In to View Trade Pricing
          </Link>
          <Link
            to="/trade/register"
            className="mx-auto font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground underline underline-offset-4 decoration-border hover:text-foreground transition-colors"
          >
            Apply for a Trade Account
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rrpLabel && (
            <p className="font-body font-light text-sm tabular-nums text-muted-foreground">
              {rrpLabel}
              <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                Excl. shipping &amp; duties
              </span>
            </p>
          )}
          <button type="button" onClick={onRequestQuote} className={primaryBtn}>
            Inquire to Purchase
          </button>
          {secureNote}
        </div>
      )}
    </div>
  );
}

