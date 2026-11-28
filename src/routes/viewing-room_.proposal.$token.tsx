import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, ExternalLink, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSharedViewingRoomProposal } from "@/lib/viewingRoomVisualiser.functions";
import { downloadViewingRoomProposal } from "@/lib/viewingRoomProposal";
import { proposalConfiguredTotal, proposalSelectedFinishes } from "@/lib/viewingRoomProposalData";
import { formatPdfDate, formatPdfMoney } from "@/lib/pdfFormatting";
import { productAttribution } from "@/lib/productAttribution";
import { viewingRoomLeadTime } from "@/lib/viewingRoom";
import affluencyLogo from "@/assets/affluency-logo-full.jpeg";

const proposalQuery = (shareToken: string) =>
  queryOptions({
    queryKey: ["shared-viewing-room-proposal", shareToken],
    queryFn: () => getSharedViewingRoomProposal({ data: { shareToken } }),
    retry: false,
    staleTime: 0,
  });

export const Route = createFileRoute("/viewing-room_/proposal/$token")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(proposalQuery(params.token)),
  head: ({ loaderData }) => {
    const title = loaderData
      ? `${loaderData.residence.name} · ${loaderData.package.tier_name} Proposal | Maison Affluency`
      : "Private Client Proposal | Maison Affluency";
    const description = loaderData
      ? `Locked interior proposal for ${loaderData.residence.name} at ${loaderData.developer.name}, curated by Maison Affluency.`
      : "Private client interior proposal curated by Maison Affluency.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  errorComponent: ({ reset }) => (
    <main className="viewing-room min-h-[100dvh] bg-background px-6 py-20 text-center text-foreground">
      <h1 className="font-display text-3xl">Proposal unavailable</h1>
      <p className="my-5 text-sm text-muted-foreground">Check your private proposal link or try again.</p>
      <Button variant="outline" onClick={reset}><RotateCw className="size-4" />Try again</Button>
    </main>
  ),
  component: SharedViewingRoomProposalPage,
});

function SharedViewingRoomProposalPage() {
  const { token } = Route.useParams();
  const { data: proposal } = useSuspenseQuery(proposalQuery(token));
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (!proposal) {
    return (
      <main className="viewing-room min-h-[100dvh] bg-background px-6 py-20 text-center text-foreground">
        <img src={affluencyLogo} alt="Maison Affluency" className="mx-auto mb-10 h-8 w-auto mix-blend-multiply" />
        <h1 className="font-display text-3xl">Proposal not found</h1>
        <p className="mt-4 text-sm text-muted-foreground">This proposal link is invalid or no longer available.</p>
      </main>
    );
  }

  const currency = proposal.snapshot.currency || proposal.package.currency;
  const totalCents = (() => {
    try { return proposalConfiguredTotal(proposal.snapshot); }
    catch { return Math.round(proposal.snapshot.total * 100); }
  })();
  const money = (cents: number) => formatPdfMoney(cents, currency);
  const leadTime = viewingRoomLeadTime(proposal.package.lead_time_weeks, proposal.snapshot.items);

  async function handleDownloadPdf() {
    if (!proposal) return;
    setDownloading(true);
    setFeedback("");
    try {
      await downloadViewingRoomProposal(proposal.snapshot, proposal.residence.name, proposal.developer.name, {
        hero: proposal.developer.hero,
        logo: proposal.developer.logo,
        floorplan: proposal.residence.floorplan_url,
        specs: proposal.residence.specs_label,
        leadTimeWeeks: proposal.package.lead_time_weeks,
        axonometricRenderUrl: proposal.axonometric_render_url,
        walkthroughUrl: proposal.walkthrough_url,
      });
      setFeedback("Proposal PDF downloaded.");
    } catch {
      setFeedback("Proposal PDF couldn’t download. Please retry.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="viewing-room min-h-[100dvh] bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4 md:px-12">
        <div className="flex min-w-0 items-center gap-3">
          {proposal.developer.logo ? (
            <img src={proposal.developer.logo} alt={proposal.developer.name} className="max-h-8 w-auto object-contain" />
          ) : (
            <span className="font-display text-lg">{proposal.developer.name}</span>
          )}
          <span aria-hidden="true" className="h-6 border-l border-border" />
          <img src={affluencyLogo} alt="Maison Affluency" className="max-h-6 w-auto object-contain mix-blend-multiply" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={downloading} onClick={() => void handleDownloadPdf()}>
            <Download className="size-4" />
            {downloading ? "Preparing PDF…" : "Download Proposal PDF"}
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-12 px-6 py-10 md:px-12">
        <section aria-label="Proposal overview" className="space-y-4 border-b border-border pb-8">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">01 / Private Client Proposal · Locked {formatPdfDate(new Date(proposal.locked_at))}</p>
          <h1 className="font-display text-4xl md:text-5xl">{proposal.developer.name} — {proposal.residence.name}</h1>
          <p className="text-base text-muted-foreground">{proposal.package.tier_name} Collection{proposal.residence.specs_label ? ` · ${proposal.residence.specs_label}` : ""}</p>
          {feedback && <p role="status" className="text-sm text-muted-foreground">{feedback}</p>}
        </section>

        <section aria-label="Spatial Context" className="space-y-6 border-b border-border pb-10">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">02 / Spatial Context</p>
            <h2 className="mt-2 font-display text-3xl">The residence, considered.</h2>
          </div>
          <div className={proposal.axonometric_render_url ? "grid gap-6 md:grid-cols-2" : ""}>
            <figure className="space-y-2">
              <div className="flex aspect-[4/3] items-center justify-center border border-border bg-card p-4">
                {proposal.residence.floorplan_url ? (
                  <img src={proposal.residence.floorplan_url} alt={`${proposal.residence.name} floor plan`} className="size-full object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">Residence floor plan to be confirmed</span>
                )}
              </div>
              <figcaption className="text-xs text-muted-foreground">Residence Floor Plan · {proposal.residence.name}</figcaption>
            </figure>
            {proposal.axonometric_render_url && (
              <figure className="space-y-2">
                <div className="aspect-[4/3] overflow-hidden border border-border bg-card">
                  <img src={proposal.axonometric_render_url} alt={`${proposal.residence.name} collection perspective render`} className="size-full object-contain" />
                </div>
                <figcaption className="text-xs text-muted-foreground">Collection Perspective Render</figcaption>
              </figure>
            )}
          </div>
          {proposal.walkthrough_url && (
            <div className="flex flex-wrap items-center justify-between gap-4 border border-border bg-card p-5">
              <div className="min-w-0 space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Interactive 3D Walkthrough</p>
                <p className="text-sm text-foreground">Explore your residence layout and selected finishes interactively in 3D.</p>
              </div>
              <Button asChild variant="outline">
                <a href={proposal.walkthrough_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Open Interactive Walkthrough
                </a>
              </Button>
            </div>
          )}
          <dl className="grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Configured Collection Total</dt>
              <dd className="mt-1 font-display text-3xl">{money(totalCents)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Estimated Lead Time</dt>
              <dd className="mt-1 font-display text-3xl">{leadTime}</dd>
            </div>
          </dl>
        </section>

        <section aria-label="Configured Collection" className="space-y-6">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">03 / The Configured Collection</p>
            <h2 className="mt-2 font-display text-3xl">Every detail, specified.</h2>
          </div>
          <div className="divide-y divide-border border-t border-border">
            {proposal.snapshot.items.map((item, idx) => {
              const attribution = productAttribution({ title: item.product_name, brandName: item.brand_name });
              const finishes = proposalSelectedFinishes(item);
              const dimensions = item.dimensions || (item.width_mm && item.depth_mm && item.height_mm ? `W ${item.width_mm} × D ${item.depth_mm} × H ${item.height_mm} mm` : "Dimensions to be confirmed");
              return (
                <article key={`${item.id}-${idx}`} className="grid grid-cols-1 gap-6 py-6 sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <div className="flex aspect-square items-center justify-center bg-muted/40 p-3">
                    {item.image_url ? <img src={item.image_url} alt={item.product_name} className="size-full object-contain" /> : <span className="text-xs text-muted-foreground">Image pending</span>}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <h3 className="font-display text-2xl">{attribution.title}</h3>
                        {attribution.designer && <p className="text-xs text-muted-foreground">{attribution.designer}</p>}
                      </div>
                      <p className="font-display text-xl">{item.retail_price != null ? `${item.retail_price_from ? "From " : ""}${money(Math.round(Number(item.retail_price) * 100))}` : "Price to be confirmed"}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{dimensions} · Lead time · {item.lead_time ?? "To be confirmed"}</p>
                    {finishes.length > 0 && (
                      <ul className="space-y-1.5 pt-2">
                        {finishes.map((finish) => (
                          <li key={`${finish.axis}:${finish.id}`} className="flex items-center gap-2.5 text-xs">
                            {finish.image_url ? <span className="size-6 shrink-0 overflow-hidden rounded-full border border-border"><img src={finish.image_url} alt={finish.name} className="size-full object-cover" /></span> : <span aria-hidden="true" className="size-6 shrink-0 rounded-full border border-border bg-muted/50" />}
                            <span className="text-muted-foreground"><span className="text-foreground">{finish.label}:</span> {finish.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}