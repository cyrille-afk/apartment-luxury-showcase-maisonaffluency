import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import type { SavedReferenceStyle } from "@/lib/aiRenderReferenceStyle";

interface AiRenderReferenceStyleControlProps {
  currentRefStyle: SavedReferenceStyle;
  enabled: boolean;
  deleting: boolean;
  onToggle: () => void;
  onDelete: () => Promise<boolean> | boolean;
}

export function AiRenderReferenceStyleControl({
  currentRefStyle,
  enabled,
  deleting,
  onToggle,
  onDelete,
}: AiRenderReferenceStyleControlProps) {
  const savedDate = new Date(currentRefStyle.updated_at).toLocaleDateString();

  return (
    <div className="rounded-md border border-border bg-muted/30 p-2.5 space-y-2.5">
      <div className="flex items-center gap-2.5">
        <img
          src={currentRefStyle.image_url}
          alt="Saved reference style"
          className="w-11 h-11 rounded border border-border object-cover shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="font-body text-[11px] text-foreground">
            Saved reference style:{" "}
            <span className="font-medium">{enabled ? "ON" : "OFF"}</span>
          </p>
          <p className="font-body text-[10px] text-muted-foreground">
            {enabled
              ? `Applied to this run (saved ${savedDate}). Turn off for a fresh layout.`
              : `Ignored by default (saved ${savedDate}) so your source plan stays faithful.`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={enabled ? "default" : "outline"}
          size="sm"
          className="flex-1 text-xs"
          disabled={deleting}
          onClick={onToggle}
        >
          {enabled ? "Turn Off Saved Style" : "Apply Saved Style"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={deleting}
          aria-label="Delete saved reference style"
          title="Delete saved reference style"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 px-2.5"
          onClick={() => {
            void onDelete();
          }}
        >
          {deleting ? (
            <DotCircleLoader size="sm" className="w-3.5 h-3.5" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}