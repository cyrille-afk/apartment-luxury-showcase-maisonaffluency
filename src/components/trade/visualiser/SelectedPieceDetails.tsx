import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDimensionsMultiline, formatImperialDimensions } from "@/lib/formatDimensions";

export default function SelectedPieceDetails({ name, price, dimensions, onClose }: {
  name: string; price: number | null; dimensions: string | null; onClose: () => void;
}) {
  const metric = formatDimensionsMultiline(dimensions);
  const imperial = formatImperialDimensions(dimensions);
  return (
    <section aria-label="Selected piece details" className="absolute bottom-3 left-3 right-3 z-10 max-w-sm rounded border border-border bg-background/95 p-4 text-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium break-words">{name}</h2>
        <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Close piece details" onClick={onClose}><X /></Button>
      </div>
      <dl className="mt-2 space-y-2 text-xs">
        <div><dt className="text-muted-foreground">Price</dt><dd className="mt-0.5">{price != null && price > 0 ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(price) : "Price upon Request"}</dd></div>
        <div><dt className="text-muted-foreground">Dimensions</dt><dd className="mt-0.5 whitespace-pre-line">{metric || "Dimensions upon request"}</dd>{imperial && <dd className="mt-0.5 whitespace-pre-line text-muted-foreground">{imperial}</dd>}</div>
      </dl>
    </section>
  );
}