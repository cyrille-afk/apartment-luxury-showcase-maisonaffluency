import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SharedQuoteSnapshot } from "@/lib/quoteClientShare";
import { getQuoteShareHead } from "@/lib/quoteShareHead.functions";
import { quoteAccessToken, quoteShareIdentity } from "@/lib/quoteSharePresentation";
import { PRODUCTION_ORIGIN } from "@/lib/environmentIndexingGuard";

export const Route = createFileRoute("/quote_/$token")({
  loader: ({ params }) => getQuoteShareHead({ data: { segment: params.token } }),
  errorComponent: () => <QuoteNotice title="Your quote is temporarily unavailable" detail="Please try again in a moment." />,
  notFoundComponent: () => <QuoteNotice title="This quote link is unavailable" detail="Please ask your designer for a current quote link." />,
  head: ({ loaderData, params }) => {
    const preview = loaderData ?? quoteShareIdentity(null);
    return {
    meta: [
      { title: preview.title },
      { name: "description", content: preview.description },
      { property: "og:title", content: preview.title },
      { property: "og:description", content: preview.description },
      { property: "og:url", content: `${PRODUCTION_ORIGIN}/quote/${encodeURIComponent(params.token)}` },
      { property: "og:site_name", content: "Maison Affluency" },
      { name: "twitter:title", content: preview.title },
      { name: "twitter:description", content: preview.description },
      ...(preview.image
        ? [
            { property: "og:image", content: preview.image },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
            { property: "og:image:alt", content: preview.imageAlt ?? preview.title },
            { name: "twitter:image", content: preview.image },
            { name: "twitter:image:alt", content: preview.imageAlt ?? preview.title },
          ]
        : []),
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: preview.image ? "summary_large_image" : "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  };
  },
  component: SharedQuotePage,
});

type Shared = SharedQuoteSnapshot & { shared_at: string; expires_at: string };

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);

const date = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));

function QuoteShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground font-body">
      <header className="bg-primary text-primary-foreground border-b border-accent">
        <div className="mx-auto max-w-5xl px-6 py-8 sm:px-10 sm:py-10 text-center">
          <p className="font-brand text-2xl sm:text-3xl font-semibold">Maison Affluency</p>
          <div className="mx-auto mt-4 h-px w-12 bg-accent" />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 sm:px-10">{children}</div>
      <footer className="mx-auto max-w-5xl px-6 sm:px-10 pb-8 pt-12">
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row sm:justify-between gap-2 text-xs text-muted-foreground">
          <p className="font-brand text-base text-foreground">Maison Affluency</p>
          <p>maisonaffluency.com</p>
        </div>
      </footer>
    </main>
  );
}

function QuoteNotice({ title, detail }: { title: string; detail?: string }) {
  return (
    <QuoteShell>
      <div className="py-24 text-center" role="status">
        <h1 className="font-display text-2xl">{title}</h1>
        {detail && <p className="mt-4 text-sm text-muted-foreground">{detail}</p>}
      </div>
    </QuoteShell>
  );
}

function SharedQuotePage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<{ status: "loading" | "missing" | "ready"; data?: Shared }>({ status: "loading" });

  useEffect(() => {
    let live = true;
    const accessToken = quoteAccessToken(token);
    if (!accessToken) { setState({ status: "missing" }); return; }
    supabase.rpc("get_shared_quote", { _token: accessToken }).then(({ data, error }) => {
      if (!live) return;
      setState(error || !data ? { status: "missing" } : { status: "ready", data: data as unknown as Shared });
    });
    return () => { live = false; };
  }, [token]);

  if (state.status === "loading") return <QuoteNotice title="Loading your quote…" />;
  if (state.status === "missing" || !state.data)
    return <QuoteNotice title="This link is no longer available" detail="It may have expired or been withdrawn. Please ask your designer for a new link." />;

  const q = state.data;
  return (
    <QuoteShell>
      <section className="py-10 sm:py-12 border-b border-border flex flex-col sm:flex-row sm:justify-between sm:items-end gap-6">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground mb-3">Your quotation</p>
          <h1 className="font-display text-3xl sm:text-4xl break-words">Quote {q.quoteRef}</h1>
          {q.clientName && <p className="text-sm mt-4 break-words"><span className="text-muted-foreground">Prepared for </span>{q.clientName}</p>}
        </div>
        <div className="text-sm text-muted-foreground sm:text-right shrink-0 space-y-2">
          <p>{q.lineCount} {q.lineCount === 1 ? "piece" : "pieces"} · {q.totalUnits} {q.totalUnits === 1 ? "unit" : "units"}</p>
          <p>Shared {date(q.shared_at)}</p>
        </div>
      </section>

        <ul className="divide-y divide-border">
          {q.lines.map((l, i) => (
            <li key={i} className="grid grid-cols-1 sm:grid-cols-[220px_minmax(0,1fr)] gap-6 sm:gap-8 py-8 sm:py-10">
              <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                {l.image ? <img src={l.image} alt={`${l.name}${l.maker ? ` by ${l.maker}` : ""}`} className="h-full w-full object-contain" loading={i === 0 ? "eager" : "lazy"} /> : <span className="font-display text-4xl text-muted-foreground" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>}
              </div>
              <div className="min-w-0 flex flex-col">
                {l.maker && <p className="text-sm font-medium text-primary break-words">{l.maker}</p>}
                <h2 className="font-display text-2xl sm:text-3xl leading-tight mt-2 break-words">{l.name}</h2>
                {(l.finish || l.dimensions) && <dl className="mt-5 space-y-3 text-sm">
                  {l.finish && <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">Finish</dt><dd className="break-words">{l.finish}</dd></div>}
                  {l.dimensions && <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">Dimensions</dt><dd className="break-words">{l.dimensions}</dd></div>}
                </dl>}
                <div className="mt-6 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div><p className="text-xs text-muted-foreground mb-1">Quantity</p><p>{l.quantity}</p></div>
                  <div><p className="text-xs text-muted-foreground mb-1">Retail unit price</p><p className="tabular-nums">{l.unitCents != null && l.currency ? money(l.unitCents, l.currency) : "Price upon Request"}</p></div>
                  {l.lineTotalCents != null && l.currency && <div className="col-span-2 sm:col-span-1 sm:text-right"><p className="text-xs text-muted-foreground mb-1">Line total</p><p className="font-medium tabular-nums">{money(l.lineTotalCents, l.currency)}</p></div>}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <section className="border-t border-border py-8 sm:py-10 flex flex-col sm:flex-row sm:justify-between gap-5">
          <h2 className="font-display text-2xl">Quotation summary</h2>
          <div className="space-y-3 sm:text-right">
          {q.totals.map((t) => (
            <div key={t.currency}><p className="text-xs text-muted-foreground mb-1">Retail total · {t.currency}</p><p className="font-display text-3xl tabular-nums">{money(t.cents, t.currency)}</p></div>
          ))}
          {q.unpricedCount > 0 && <p className="text-xs text-muted-foreground">{q.unpricedCount} piece{q.unpricedCount === 1 ? "" : "s"} Price upon Request</p>}
          </div>
        </section>
        <div className="border-l-2 border-accent pl-4 text-xs leading-relaxed text-muted-foreground space-y-1">
          <p>Available until {date(q.expires_at)}.</p>
          <p>Prices are indicative and exclude delivery and taxes.</p>
        </div>
    </QuoteShell>
  );
}
