import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import { clearCart } from "@/lib/cart";

export default function OrderConfirmation() {
  const [params] = useSearchParams();
  const ref = params.get("ref");
  const status = params.get("status");
  const bank = status === "bank_transfer";

  useEffect(() => {
    if (status === "paid") clearCart();
  }, [status]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Order Received — Maison Affluency</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <Navigation borderless />

      <div className="pt-[calc(env(safe-area-inset-top,0px)+7rem)] md:pt-36 pb-24 max-w-2xl mx-auto px-4 sm:px-6">
        <h1 className="font-display font-normal text-[1.6rem] md:text-[2rem] tracking-[-0.01em]">
          {bank ? "Order Reserved" : "Thank You for Your Order"}
        </h1>

        {ref && (
          <p className="mt-4 font-body text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Reference {ref}
          </p>
        )}

        <p className="mt-6 font-body text-sm leading-relaxed text-muted-foreground">
          {bank
            ? "Your pieces are reserved. Our concierge will email you the bank transfer details and a pro-forma invoice within one business day. Production begins once funds are received."
            : "Your payment has been received. Our concierge will confirm production lead times, delivery scheduling and any duties applicable to your destination within one business day."}
        </p>

        <Link
          to="/designers"
          className="mt-10 inline-flex items-center justify-center px-6 py-3 bg-foreground text-background font-body text-[10px] uppercase tracking-[0.22em]"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
