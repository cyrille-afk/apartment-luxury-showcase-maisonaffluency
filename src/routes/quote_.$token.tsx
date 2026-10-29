import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SharedQuoteSnapshot } from "@/lib/quoteClientShare";

export const Route = createFileRoute("/quote_/$token")({
  head: () => ({
    meta: [
      { title: "Your Quote — Maison Affluency" },
      { name: "description", content: "A curated, itemised selection prepared for you by your designer." },
      { property: "og:title", content: "Your Quote — Maison Affluency" },
      { property: "og:description", content: "A curated, itemised selection prepared for you by your designer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SharedQuotePage,
});

type Shared = SharedQuoteSnapshot & { shared_at: string; expires_at: string };

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);

function SharedQuotePage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<{ status: "loading" | "missing" | "ready"; data?: Shared }>({ status: "loading" });

  useEffect(() => {
    let live = true;
    supabase.rpc("get_shared_quote", { _token: token }).then(({ data, error }) => {
      if (!live) return;
      setState(error || !data ? { status: "missing" } : { status: "ready", data: data as unknown as Shared });
    });
    return () => { live = false; };
  }, [token]);

  if (state.status === "loading") return <main className="min-h-screen flex items-center justify-center font-body text-sm text-muted-foreground">Loading your quote…</main>;
  if (state.status === "missing" || !state.data)
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="font-display text-2xl">This link is no longer available</h1>
        <p className="font-body text-sm text-muted-foreground">It may have expired or been withdrawn. Please ask your designer for a new link.</p>
      </main>
    );

  const q = state.data;
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="font-body text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Maison Affluency</p>
        <h1 className="font-display text-3xl mt-2">Quote {q.quoteRef}</h1>
        {q.clientName && <p className="font-body text-sm text-muted-foreground mt-1">Prepared for {q.clientName}</p>}
        <p className="font-body text-xs text-muted-foreground mt-1">
          {q.lineCount} {q.lineCount === 1 ? "piece" : "pieces"} · {q.totalUnits} {q.totalUnits === 1 ? "unit" : "units"} · Retail prices
        </p>

        <ul className="mt-8 divide-y divide-border border-y border-border">
          {q.lines.map((l, i) => (
            <li key={i} className="flex gap-4 py-5">
              {l.image && <img src={l.image} alt={l.name} className="h-24 w-24 object-cover rounded-sm bg-muted shrink-0" loading="lazy" />}
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-lg leading-tight">{l.name}</h2>
                {l.maker && <p className="font-body text-xs uppercase tracking-wider text-muted-foreground">{l.maker}</p>}
                {l.finish && <p className="font-body text-xs mt-1">{l.finish}</p>}
                {l.dimensions && <p className="font-body text-xs text-muted-foreground">{l.dimensions}</p>}
                <div className="font-body text-xs mt-2 grid grid-cols-3 gap-2">
                  <span>Qty {l.quantity}</span>
                  <span>{l.unitCents != null && l.currency ? `Unit ${money(l.unitCents, l.currency)}` : "Price upon Request"}</span>
                  <span className="text-right font-medium">{l.lineTotalCents != null && l.currency ? money(l.lineTotalCents, l.currency) : ""}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 space-y-1 text-right font-body">
          {q.totals.map((t) => (
            <p key={t.currency} className="text-base"><span className="text-xs uppercase tracking-widest text-muted-foreground mr-3">Retail total</span>{money(t.cents, t.currency)}</p>
          ))}
          {q.unpricedCount > 0 && <p className="text-xs text-muted-foreground">{q.unpricedCount} piece{q.unpricedCount === 1 ? "" : "s"} Price upon Request</p>}
        </div>
        <p className="mt-10 font-body text-[11px] text-muted-foreground">
          Shared {new Date(q.shared_at).toLocaleDateString("en-GB")} · available until {new Date(q.expires_at).toLocaleDateString("en-GB")}. Prices are indicative and exclude delivery and taxes.
        </p>
      </div>
    </main>
  );
}
