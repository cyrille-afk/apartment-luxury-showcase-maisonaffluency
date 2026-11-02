import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SharedQuoteSnapshot } from "@/lib/quoteClientShare";
import { getQuoteShareHead } from "@/lib/quoteShareHead.functions";
import { quoteAccessToken, quoteShareIdentity } from "@/lib/quoteSharePresentation";
import { PRODUCTION_ORIGIN } from "@/lib/environmentIndexingGuard";
import { useServerFn } from "@tanstack/react-start";
import { readNamedQuote, requestNamedQuoteCode, verifyNamedQuoteCode } from "@/lib/namedQuoteAccess.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [state, setState] = useState<{ status: "loading" | "missing" | "gate" | "ready"; data?: Shared }>({ status: "loading" });
  const readQuote = useServerFn(readNamedQuote);
  const requestCode = useServerFn(requestNamedQuoteCode);
  const verifyCode = useServerFn(verifyNamedQuoteCode);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let live = true;
    const accessToken = quoteAccessToken(token);
    if (!accessToken) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(token) || token === "invalid") { setState({ status: "missing" }); return; }
      readQuote({ data: { slug: token } }).then((data) => {
        if (!live) return;
        setState(data ? { status: "ready", data: data as unknown as Shared } : { status: "gate" });
        if (data) window.__lovableEvents?.track?.("project.quote_opened", {});
      }).catch(() => { if (live) { setState({ status: "gate" }); setFeedback("Your quote could not be loaded. Please verify your email again."); } });
      return () => { live = false; };
    }
    supabase.rpc("get_shared_quote", { _token: accessToken }).then(({ data, error }) => {
      if (!live) return;
      setState(error || !data ? { status: "missing" } : { status: "ready", data: data as unknown as Shared });
      if (!error && data) window.__lovableEvents?.track?.("project.quote_opened", {});
    });
    return () => { live = false; };
  }, [token]);

  const submitAccess = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setFeedback("");
    try {
      if (!codeSent) {
        await requestCode({ data: { slug: token, email } });
        setCodeSent(true);
      } else {
        const result = await verifyCode({ data: { slug: token, email, code } });
        if (!result.ok) { setFeedback("That code is incorrect or has expired. Please try again."); return; }
        const data = await readQuote({ data: { slug: token } });
        if (!data) { setFeedback("This quote is no longer available. Please ask for a new link."); return; }
        setState({ status: "ready", data: data as unknown as Shared });
        window.__lovableEvents?.track?.("project.quote_opened", {});
      }
    } catch { setFeedback("Access could not be verified. Please try again shortly."); }
    finally { setBusy(false); }
  };

  if (state.status === "loading") return <QuoteNotice title="Loading your quote…" />;
  if (state.status === "gate") return <QuoteShell><section className="max-w-md mx-auto py-16 sm:py-24">
    <h1 className="font-display text-3xl">Your private quote</h1>
    <p className="mt-4 text-sm text-muted-foreground">{codeSent ? "If this email is linked to an available quote, a verification code has been sent. Enter it below." : "Verify the email address your designer used for this quote."}</p>
    <form className="mt-8 space-y-5" onSubmit={submitAccess}>
      <div><label htmlFor="quote-email" className="text-sm">Email address</label><Input id="quote-email" className="mt-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" disabled={busy || codeSent} /></div>
      {codeSent && <div><label htmlFor="quote-code" className="text-sm">Verification code</label><Input id="quote-code" className="mt-2" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy} /></div>}
      <p role="status" className="min-h-5 text-sm text-destructive">{feedback}</p>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : codeSent ? "Open quote" : "Send verification code"}</Button>
      {codeSent && <Button type="button" variant="link" disabled={busy} onClick={() => { setCodeSent(false); setCode(""); setFeedback(""); }}>Change email or request a new code</Button>}
    </form>
  </section></QuoteShell>;
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
                <section className="mt-5" aria-label={`${l.name} specifications`}>
                  <h3 className="text-xs font-medium text-foreground mb-3">Specifications</h3>
                  <dl className="space-y-3 text-sm">
                    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">Dimensions</dt><dd className="break-words">{l.dimensions || "Not specified"}</dd></div>
                    {(() => {
                      const hasFinish = !!l.finish && l.finish.trim() !== l.dimensions?.trim();
                      const swatches = (l.finishSwatches ?? []).filter((sw) => sw.image);
                      return <>
                        {hasFinish && <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">Selected finish</dt><dd className="break-words">
                          {swatches.length > 0 ? <ul className="flex flex-wrap gap-4">{swatches.map((sw) => <li key={sw.name} className="flex items-center gap-3"><img src={sw.image!} alt={sw.name} className="h-14 w-14 object-cover border border-border" loading="lazy" /><span>{sw.name}</span></li>)}</ul> : l.finish}
                        </dd></div>}
                        {!hasFinish && <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">Materials</dt><dd className="break-words">{l.materials || "Not specified"}</dd></div>}
                        {!hasFinish && !!l.finishOptions?.length && <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">Finish options</dt><dd className="break-words">{l.finishOptions.join(" · ")}</dd></div>}
                      </>;
                    })()}
                  </dl>
                </section>
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
