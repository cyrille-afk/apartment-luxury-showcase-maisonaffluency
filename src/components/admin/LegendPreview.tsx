import { useState } from "react";
import LegendDisclosure from "@/components/LegendDisclosure";
import { cn } from "@/lib/utils";

type View = "public" | "studio" | "presentation";
const VIEWS: { id: View; label: string }[] = [
  { id: "public", label: "Public" },
  { id: "studio", label: "Studio" },
  { id: "presentation", label: "Presentation" },
];

/** Admin-only preview of a product legend as rendered in each product view. */
export default function LegendPreview({ text }: { text: string }) {
  const [view, setView] = useState<View>("public");
  if (!text.trim()) return null;
  return (
    <div className="mt-2 rounded border border-border/60 p-2">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] text-muted-foreground mr-1">Preview:</span>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded border",
              view === v.id ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div
        key={view}
        className={cn("bg-background px-3", view !== "public" && "trade-portal-shell")}
        {...(view === "presentation" ? { "data-presentation": "true" } : {})}
      >
        <LegendDisclosure icon={null} text={text} />
      </div>
    </div>
  );
}
