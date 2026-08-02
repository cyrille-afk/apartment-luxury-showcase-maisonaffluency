import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface OrderDetails {
  product_name: string;
  selected_finish: string | null;
  customer_email: string | null;
  transaction_id: string;
  amount_total: number;
  currency: string;
  status: string;
  created_at: string;
}

function formatOrderCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency?.toUpperCase() || "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatOrderDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Success() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("No session identifier found.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchOrder() {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("get-order-by-session", {
          body: { session_id: sessionId },
        });

        if (cancelled) return;

        if (fnError) throw fnError;
        if ((data as any)?.error) throw new Error((data as any).error);
        if (!(data as any)?.order) throw new Error("Order details could not be loaded.");

        setOrder((data as any).order as OrderDetails);
      } catch (err: any) {
        setError(err?.message || "Unable to load order details.");
      } finally {
        setLoading(false);
      }
    }

    void fetchOrder();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Order Confirmed — Maison Affluency</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <Navigation borderless />

      <main className="pt-[var(--header-h)] pb-24 px-4 sm:px-6">
        <div className="max-w-xl mx-auto">
          <div className="flex flex-col items-center text-center">
            <div className="relative flex items-center justify-center w-16 h-16 rounded-full border border-foreground/10 bg-foreground/5">
              <Check className="w-7 h-7 text-foreground/80 stroke-[1.5]" />
              <span className="absolute inset-0 rounded-full animate-ping bg-foreground/5" style={{ animationDuration: "2.4s" }} />
            </div>

            <h1 className="mt-8 font-display font-normal text-[1.75rem] md:text-[2.25rem] tracking-[-0.01em] leading-tight">
              Thank You For Your Order
            </h1>

            <p className="mt-3 font-body text-sm text-muted-foreground max-w-sm">
              Your payment has been securely processed by Stripe.
            </p>
          </div>

          <div className="mt-12">
            {loading ? (
              <div className="space-y-6">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : error || !order ? (
              <div className="text-center py-10">
                <p className="font-body text-sm text-muted-foreground">
                  {error || "We couldn't locate your order."}
                </p>
                <p className="mt-2 font-body text-xs text-muted-foreground">
                  If you completed a purchase, a confirmation email will arrive shortly.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-none border border-foreground/10 bg-background p-6 md:p-8">
                  <div className="flex items-center justify-between pb-6 mb-6 border-b border-foreground/10">
                    <div>
                      <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        Order Status
                      </p>
                      <p className="mt-1 font-body text-sm text-foreground">
                        Payment Confirmed via Stripe
                      </p>
                    </div>
                    <span className="inline-flex items-center px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.18em] bg-foreground text-background">
                      {order.status}
                    </span>
                  </div>

                  <dl className="space-y-5">
                    <div>
                      <dt className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        Transaction ID
                      </dt>
                      <dd className="mt-1 font-body text-sm text-foreground break-all">
                        {order.transaction_id}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        Date
                      </dt>
                      <dd className="mt-1 font-body text-sm text-foreground">
                        {formatOrderDate(order.created_at)}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        Product
                      </dt>
                      <dd className="mt-1 font-display text-base md:text-lg text-foreground leading-snug">
                        {order.product_name}
                      </dd>
                    </div>

                    {order.selected_finish ? (
                      <div>
                        <dt className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                          Selected Finish
                        </dt>
                        <dd className="mt-1 font-body text-sm text-foreground">
                          {order.selected_finish}
                        </dd>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between pt-4 border-t border-foreground/10">
                      <dt className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        Total Paid
                      </dt>
                      <dd className="font-display text-lg md:text-xl text-foreground">
                        {formatOrderCurrency(order.amount_total, order.currency)}
                      </dd>
                    </div>

                    {order.customer_email ? (
                      <div>
                        <dt className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                          Confirmation Email
                        </dt>
                        <dd className="mt-1 font-body text-sm text-foreground break-all">
                          {order.customer_email}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>

                <div className="mt-8 p-6 md:p-8 border-l border-foreground/20 bg-foreground/[0.02]">
                  <p className="font-body text-sm leading-relaxed text-foreground/80">
                    A formal digital receipt has been sent to your email. Our concierge team will reach out to you within 24 hours to confirm shipping logistics and bespoke delivery arrangements.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="mt-10 flex justify-center">
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
