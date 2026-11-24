import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Layers, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import { listLockedProposalsForDeveloper } from "@/lib/viewingRoomVisualiser.functions";
import { sharedProposalPath, visualiserProposalPath } from "@/lib/viewingRoomVisualiser";
import { formatPdfMoney } from "@/lib/pdfFormatting";

export default function ViewingRoomLockedProposals({ developerId }: { developerId: string }) {
  const listProposals = useServerFn(listLockedProposalsForDeveloper);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["viewing-room-locked-proposals", developerId],
    queryFn: () => listProposals({ data: { developerProjectId: developerId } }),
    retry: false,
  });

  return (
    <section aria-label="Locked client proposals" className="space-y-3 border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-lg">Locked Client Proposals</h3>
        <Button size="icon" variant="ghost" aria-label="Refresh locked proposals" disabled={isFetching} onClick={() => void refetch()}>
          <RotateCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>
      {isLoading && <p className="text-xs text-muted-foreground">Loading locked proposals…</p>}
      {isError && <p role="alert" className="text-xs text-destructive">Locked proposals couldn’t load.</p>}
      {!isLoading && !isError && !data?.length && (
        <p className="text-xs text-muted-foreground">No buyer proposals locked yet.</p>
      )}
      {!!data?.length && (
        <ul className="divide-y divide-border">
          {data.map((row) => (
            <li key={row.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-base leading-snug">{row.residenceName}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.tierName} · {row.itemCount} {row.itemCount === 1 ? "piece" : "pieces"} · {new Date(row.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs font-medium">{formatPdfMoney(Math.round(row.total * 100), row.currency)}</span>
              </div>
              {(row.axonometricRenderUrl || row.walkthroughUrl) && (
                <p className="text-[11px] text-muted-foreground">
                  Published: {[row.axonometricRenderUrl ? "Axonometric render" : null, row.walkthroughUrl ? "Interactive walkthrough" : null].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="studio-primary">
                  <Link to={visualiserProposalPath(row.id)}>
                    <Layers className="size-3.5" />
                    Stage in Visualiser
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={sharedProposalPath(row.shareToken)} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" />
                    Proposal page
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}