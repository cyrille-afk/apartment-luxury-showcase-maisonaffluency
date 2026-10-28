import { cn } from "@/lib/utils";

/** Client-facing price typography shared by product pages and workspaces. */
export default function RetailPrice({ label, className }: { label?: string | null; className?: string }) {
  const hasPrice = Boolean(label && label.trim().toLowerCase() !== "price upon request");
  return (
    <p data-retail-price className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1 font-body font-light text-base md:text-lg leading-snug tabular-nums text-foreground", className)}>
      <span>{label || "Price upon Request"}</span>
      {hasPrice && <span className="font-body text-[10px] font-normal uppercase text-muted-foreground">Retail Price</span>}
    </p>
  );
}