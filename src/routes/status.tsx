import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Activity, ArrowLeft, CheckCircle2, CircleHelp, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWebsiteStatus } from "@/lib/websiteStatus.functions";
import { availability, PUBLIC_STATUS_PAGES } from "@/lib/websiteStatus";

const statusQuery = queryOptions({
  queryKey: ["public-website-status"], queryFn: () => getWebsiteStatus(),
  staleTime: 30000, refetchInterval: 60000,
});

export const Route = createFileRoute("/status")({
  head: () => ({ meta: [
    { title: "Website Status — Maison Affluency" },
    { name: "description", content: "Current Maison Affluency website availability and recently recorded service interruptions." },
    { property: "og:title", content: "Website Status — Maison Affluency" },
    { property: "og:description", content: "Check current website availability and recent service interruptions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(statusQuery); },
  component: WebsiteStatus,
});

const date = (value: string) => new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
}).format(new Date(value));

function WebsiteStatus() {
  const { data, refetch, isFetching, isError } = useSuspenseQuery(statusQuery);
  const services = PUBLIC_STATUS_PAGES.map(page => {
    const row = data.services.find(service => service.path === page.path);
    return { ...page, row, state: data.error || isError || !row ? "unknown" : availability(row.available, row.checked_at, Math.max(data.now, Date.now())) };
  });
  const hasFailure = services.some(service => service.state === "unavailable");
  const hasUnknown = services.some(service => service.state === "unknown");
  const Icon = hasFailure ? TriangleAlert : hasUnknown ? CircleHelp : CheckCircle2;
  const heading = hasFailure ? "Service interruption" : hasUnknown ? "Status unconfirmed" : "All services operational";
  const latest = data.services.map(s => s.checked_at).sort().at(-1);
  return (
    <main className="min-h-screen bg-background text-foreground font-body">
      <header className="border-b border-border px-6 py-7">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
          <Link to="/" className="font-display text-xl">Maison Affluency</Link>
          <Link to="/" className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowLeft className="size-4" /> Return to website</Link>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground"><Activity className="size-4" /> Website status</div>
        <div className="mt-6 flex items-start gap-4" role="status">
          <Icon className={`mt-1 size-8 shrink-0 ${hasFailure ? "text-destructive" : hasUnknown ? "text-muted-foreground" : "text-primary"}`} />
          <div><h1 className="font-display text-3xl sm:text-4xl">{heading}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{latest ? `Last checked ${date(latest)} UTC` : "Monitoring data is temporarily unavailable."}</p></div>
        </div>
        <div className="mt-8 flex items-center justify-between gap-4 border-b border-border pb-5">
          <span className="text-xs text-muted-foreground">Checks every five minutes · Times in UTC</span>
          <Button variant="ghost" size="icon" aria-label="Refresh status" title="Refresh status" onClick={() => void refetch()} disabled={isFetching}><RefreshCw className={`size-4 ${isFetching ? "animate-spin motion-reduce:animate-none" : ""}`} /></Button>
        </div>
        <section aria-label="Current availability">
          {services.map(service => (
            <div key={service.path} className="flex items-center justify-between gap-4 border-b border-border py-5">
              <span className="text-sm">{service.label}</span>
              <span className={`flex items-center gap-2 text-xs ${service.state === "unavailable" ? "text-destructive" : service.state === "unknown" ? "text-muted-foreground" : "text-primary"}`}>
                {service.state === "operational" ? <CheckCircle2 className="size-4" /> : service.state === "unknown" ? <CircleHelp className="size-4" /> : <TriangleAlert className="size-4" />}
                {service.state === "operational" ? "Operational" : service.state === "unknown" ? "Unconfirmed" : "Unavailable"}
              </span>
            </div>
          ))}
        </section>
        <section className="mt-14" aria-labelledby="incident-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3"><h2 id="incident-heading" className="font-display text-2xl">Recent interruptions</h2><span className="text-xs text-muted-foreground">Last 30 days</span></div>
          {data.error || isError ? <p className="mt-6 text-sm text-muted-foreground">Interruption history is temporarily unavailable.</p> : data.incidents.length === 0 ? <p className="mt-6 text-sm text-muted-foreground">No interruptions recorded since history tracking began on 25 October 2026.</p> : (
            <div className="mt-6">{data.incidents.map(incident => (
              <article key={incident.id} className="border-t border-border py-6">
                <div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-medium">{PUBLIC_STATUS_PAGES.find(p => p.path === incident.path)?.label ?? "Website"} interruption</h3><span className={`text-xs ${incident.resolved_at ? "text-primary" : "text-destructive"}`}>{incident.resolved_at ? "Resolved" : "Ongoing"}</span></div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Detected {date(incident.started_at)} UTC{incident.resolved_at ? ` · Recovered ${date(incident.resolved_at)} UTC` : ""}</p>
              </article>
            ))}</div>
          )}
          <p className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">History tracking began on 25 October 2026. Short interruptions between checks may not be recorded.</p>
        </section>
      </div>
    </main>
  );
}