import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AlertCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";

/**
 * Shown when a Stripe Checkout payment does not complete — a declined card
 * (e.g. test card 4000 0000 0000 0002), an authentication failure, or the
 * buyer backing out of the hosted Checkout page.
 */
const REASONS: Record<string, { title: string; body: string }> = {
  card_declined: {
    title: "Card Declined",
    body: "Your bank declined this card. No funds were taken. Please try a different card, or contact your bank and retry.",
  },
  expired_card: {
    title: "Card Expired",
    body: "The card entered has expired. No funds were taken. Please retry with a valid card.",
  },
  insufficient_funds: {
    title: "Card Declined",
    body: "The card was declined for insufficient funds. No funds were taken. Please retry with a different card.",
  },
  authentication_failed: {
    title: "Authentication Failed",
    body: "The bank could not verify this payment. No funds were taken. Please retry and complete the verification step.",
  },
  cancelled: {
    title: "Payment Not Completed",
    body: "The checkout was closed before payment was confirmed. No funds were taken — your link remains valid.",
  },
};

export default function PaymentFailed() {
  const [params] = useSearchParams();
  const reasonKey = (params.get("reason") || "cancelled").toLowerCase();
  const reason = REASONS[reasonKey] ?? REASONS.cancelled;
  const message = params.get("message");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Payment Not Completed — Maison Affluency</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <Navigation borderless />

      <main className="pt-[var(--header-h)] pb-24 px-4 sm:px-6">
        <div className="max-w-xl mx-auto">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full border border-destructive/30 bg-destructive/5">
              <AlertCircle className="w-7 h-7 text-destructive stroke-[1.5]" />
            </div>

            <h1 className="mt-8 font-display font-normal text-[1.75rem] md:text-[2.25rem] tracking-[-0.01em] leading-tight">
              {reason.title}
            </h1>

            <p className="mt-3 font-body text-sm text-muted-foreground max-w-sm">
              {message || reason.body}
            </p>
          </div>

          <div
            role="alert"
            className="mt-10 border-l-2 border-destructive/60 bg-destructive/[0.04] p-6 md:p-8"
          >
            <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              What happens next
            </p>
            <p className="mt-3 font-body text-sm leading-relaxed text-foreground/80">
              Nothing has been charged and your specification is still reserved. You can return to
              the secure checkout and try again with another card, or write to our team and we will
              arrange a bank transfer instead.
            </p>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => window.history.back()}
              className="rounded-none px-8 py-6 font-body text-[10px] uppercase tracking-[0.22em]"
            >
              Try Payment Again
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-none px-8 py-6 font-body text-[10px] uppercase tracking-[0.22em] border-foreground/20 hover:bg-foreground hover:text-background"
            >
              <Link to="/gallery">Return to Gallery</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
