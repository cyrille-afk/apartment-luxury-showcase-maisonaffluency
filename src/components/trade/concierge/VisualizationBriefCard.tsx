import { useNavigate } from "react-router-dom";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import type { VisualizationBriefProposal } from "@/lib/tradeConciergeStream";
import { RequirementsBadge } from "@/components/trade/concierge/RequirementsBadge";

export const VIZ_BRIEF_INCOMING_KEY = "maf:axonometric:incoming-brief";

const MODE_LABELS: Record<VisualizationBriefProposal["args"]["mode"], string> = {
  composite: "Composite (overlay pieces in a room)",
  stylize: "Stylize an existing render",
  elevation_to_axo: "Elevation → Axonometric",
  section_to_axo: "Section → Axonometric",
  cad_overlay: "CAD overlay",
  "3d_to_cad": "3D → CAD",
};

type Props = {
  proposal: VisualizationBriefProposal;
  resolved?: "opened" | "discarded";
  onResolved: (outcome: "opened" | "discarded") => void;
};

export function VisualizationBriefCard({ proposal, resolved, onResolved }: Props) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { args, preview } = proposal;
  const title = args.title || args.room_label || "Visualization brief";

  const handleRender = () => {
    try {
      sessionStorage.setItem(
        VIZ_BRIEF_INCOMING_KEY,
        JSON.stringify({
          ...args,
          overlay_image_urls: preview.map((p) => p.image_url).filter(Boolean),
          savedAt: Date.now(),
        }),
      );
    } catch {
      /* sessionStorage full — degrade gracefully, studio still opens */
    }
    onResolved("opened");
    // Admins go straight into the in-house Studio; trade users land on the
    // request-submission flow with the brief prefilled (the Studio page is
    // admin-only and would otherwise bounce them back to /trade).
    navigate(isAdmin ? "/trade/axonometric" : "/trade/axonometric-requests");
  };

  return (
    <div className="rounded-lg border border-border bg-card/40 backdrop-blur-sm p-4 my-2 space-y-3">
      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 mt-0.5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-medium leading-tight">{title}</div>
            <RequirementsBadge validation={proposal.requirements_validation} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {MODE_LABELS[args.mode]} · {args.style_preset}
            {args.room_label && args.title ? ` · ${args.room_label}` : ""}
          </div>
        </div>
        {!resolved && (
          <button
            type="button"
            onClick={() => onResolved("discarded")}
            className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            aria-label="Discard brief"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {args.brief_notes && (
        <p className="text-sm text-foreground/85 leading-relaxed italic">
          “{args.brief_notes}”
        </p>
      )}

      {preview.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
            Overlay pieces ({preview.length})
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {preview.map((p) => (
              <div
                key={p.id}
                className="w-14 h-14 shrink-0 rounded bg-muted overflow-hidden border border-border/50"
                title={p.title}
              >
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt={p.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {args.source_image_url && (
        <div className="text-[11px] text-muted-foreground">
          Reference image attached.
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {resolved === "opened" ? (
          <span className="text-xs text-muted-foreground">Opened in studio</span>
        ) : resolved === "discarded" ? (
          <span className="text-xs text-muted-foreground">Discarded</span>
        ) : (
          <Button size="sm" onClick={handleRender} className="gap-1.5">
            Render Scene
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
