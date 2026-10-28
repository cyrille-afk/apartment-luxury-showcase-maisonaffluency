import { useClientSafeMode } from "@/lib/clientSafeMode";

/** Retail and net are separate inputs: saved net snapshots are never retail. */
export default function DrawerPricing({ retailLabel, netLabel }: { retailLabel?: string | null; netLabel?: string | null }) {
  const { clientSafe } = useClientSafeMode();
  return (
    <div className="mt-2 space-y-1 font-body text-xs">
      <p className="text-muted-foreground">Retail Price: <span className="font-medium text-foreground">{retailLabel || "Price upon Request"}</span></p>
      {!clientSafe && netLabel && (
        <p data-trade-sensitive className="flex flex-wrap items-baseline gap-x-2 text-foreground">
          <span className="font-medium">{netLabel}</span>
          <span className="text-[10px] uppercase text-muted-foreground">Net Trade Price</span>
        </p>
      )}
    </div>
  );
}