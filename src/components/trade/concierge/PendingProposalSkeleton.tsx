import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Skeleton card rendered as soon as the concierge model begins streaming a
 * card-producing tool call (`propose_tearsheet`, `add_to_tearsheet`,
 * `draft_quote`, `add_to_quote`, `propose_ffe_rows`,
 * `prepare_visualization_brief`), BEFORE the completed `event: proposal`
 * frame arrives. Gives the architect a "the AI is thinking about this
 * exact deliverable" signal instead of a blank pause.
 *
 * Consumed by <AIConcierge /> via the `pending_proposal` timeline kind.
 * Replaced in place once the real proposal frame arrives.
 */
export type PendingProposalTool =
  | "propose_tearsheet"
  | "add_to_tearsheet"
  | "draft_quote"
  | "add_to_quote"
  | "propose_ffe_rows"
  | "prepare_visualization_brief";

const LABELS: Record<PendingProposalTool, { title: string; sub: string; rows: number; layout: "grid" | "list" }> = {
  propose_tearsheet:         { title: "Curating a tearsheet…",        sub: "Scanning ateliers, matching typology, scale and material.", rows: 4, layout: "grid" },
  add_to_tearsheet:          { title: "Adding to your tearsheet…",    sub: "Selecting complementary pieces from the catalogue.",       rows: 3, layout: "grid" },
  draft_quote:               { title: "Drafting the quote…",          sub: "Pricing lines, applying trade discount and lead times.",   rows: 4, layout: "list" },
  add_to_quote:              { title: "Appending to the quote…",      sub: "Adding lines to the existing draft.",                       rows: 2, layout: "list" },
  propose_ffe_rows:          { title: "Preparing the FF&E schedule…", sub: "Organising items room by room.",                            rows: 5, layout: "list" },
  prepare_visualization_brief: { title: "Preparing the render brief…", sub: "Composing the scene for Axonometric Studio.",              rows: 3, layout: "grid" },
};

interface Props {
  tool: PendingProposalTool;
}

export function PendingProposalSkeleton({ tool }: Props) {
  const meta = LABELS[tool];
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={meta.title}
      className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <div className="text-sm font-medium text-foreground/90">{meta.title}</div>
      </div>
      <div className="text-xs text-muted-foreground mb-4">{meta.sub}</div>

      {meta.layout === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: meta.rows }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className={cn(
                "aspect-square w-full rounded-lg bg-muted/70",
                "animate-pulse",
              )} style={{ animationDelay: `${i * 90}ms` }} />
              <div className="h-2.5 w-3/4 rounded bg-muted/70 animate-pulse" style={{ animationDelay: `${i * 90 + 40}ms` }} />
              <div className="h-2 w-1/2 rounded bg-muted/50 animate-pulse" style={{ animationDelay: `${i * 90 + 80}ms` }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {Array.from({ length: meta.rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-md bg-muted/70 animate-pulse" style={{ animationDelay: `${i * 90}ms` }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-2/3 rounded bg-muted/70 animate-pulse" style={{ animationDelay: `${i * 90 + 40}ms` }} />
                <div className="h-2 w-1/3 rounded bg-muted/50 animate-pulse" style={{ animationDelay: `${i * 90 + 80}ms` }} />
              </div>
              <div className="h-6 w-14 rounded bg-muted/60 animate-pulse" style={{ animationDelay: `${i * 90 + 120}ms` }} />
            </div>
          ))}
        </div>
      )}

      <span className="sr-only">The concierge is composing this proposal.</span>
    </div>
  );
}
