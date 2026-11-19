import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getViewingRoomPackage } from "@/lib/viewingRoom.functions";
import { viewingRoomLeadTime, type ViewingRoom } from "@/lib/viewingRoom";

type Package = ViewingRoom["layouts"][number]["packages"][number];
const descriptions: Record<string, string> = {
  Essential: "A considered foundation of signature furnishings, balanced proportions and quietly tactile finishes.",
  Signature: "A layered composition of distinctive seating, sculptural tables and richly coordinated materials.",
  Bespoke: "An individual expression of the residence, bringing collectible pieces and exceptional finishes into dialogue.",
};
export default function ViewingRoomCollectionCard({ token, collection, onSelect }: { token: string; collection: Package; onSelect: () => void }) {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["viewing-room-package", token, collection.id], queryFn: () => getViewingRoomPackage({ data: { token, packageId: collection.id } }), retry: false });
  const pictures = data?.items.filter(item => item.image_url).slice(0, 4) ?? [];
  const materials = Array.from(new Map(data?.items.flatMap(item => Object.values(item.materials)).filter(material => material.image_url).map(material => [material.id, material]) ?? []).values()).slice(0, 4);
  return <article className="min-w-0 border border-border">
    <Button variant="ghost" onClick={onSelect} aria-label={`Select ${collection.tier_name} collection`} className="h-auto w-full flex-col items-stretch gap-0 rounded-none p-0 text-left whitespace-normal">
      <div className="flex h-36 w-full items-center gap-2 overflow-hidden border-b border-border bg-muted/40 p-3" aria-label={`${collection.tier_name} furniture preview`}>
        {pictures.map(item => <img key={item.id} src={item.image_url ?? undefined} alt={item.product_name} className="h-full min-w-0 flex-1 object-contain" />)}
        {!pictures.length && <span className="text-xs text-muted-foreground">{isPending ? "Preparing collection…" : isError ? "Preview unavailable" : "Collection imagery being prepared"}</span>}
      </div>
      <div className="flex w-full flex-1 flex-col gap-4 p-5"><h2 className="font-display text-2xl">{collection.tier_name}</h2><p className="min-h-16 text-sm font-normal leading-relaxed text-muted-foreground">{descriptions[collection.tier_name] ?? collection.description}</p>
        <div className="flex h-6 gap-2" aria-label="Selected materials">{materials.map(material => <span key={material.id} className="size-6 shrink-0 overflow-hidden rounded-full border border-black/15"><img src={material.image_url ?? undefined} alt={material.name} title={material.name} className="size-full object-cover" /></span>)}</div>
        <p className="font-display text-2xl">{new Intl.NumberFormat("en-GB", { style: "currency", currency: collection.currency, maximumFractionDigits: 0 }).format(collection.package_price)}</p>
        <p className="text-xs font-normal text-muted-foreground">Estimated lead time · {viewingRoomLeadTime(collection.lead_time_weeks, data?.items)}</p><span className="mt-2 flex items-center justify-between text-xs">Explore collection<ArrowRight className="size-4" /></span>
      </div>
    </Button>
    {isError && <Button variant="ghost" className="m-3" onClick={() => void refetch()}>Retry preview</Button>}
  </article>;
}