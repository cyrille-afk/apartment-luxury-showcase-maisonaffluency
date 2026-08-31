import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Shipping & White-Glove Installation" disclosure shown directly beneath the
 * price. Replaces the bare "excl. shipping & duties" caption, which read as a
 * hidden-cost warning rather than a service promise.
 */
export default function ShippingDetailsAccordion({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("mt-3 mb-2 border-t border-border/60", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-3 text-left"
      >
        <span className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Shipping &amp; White-Glove Installation
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="pb-4 space-y-3 font-body text-[13px] leading-relaxed text-muted-foreground">
          <p>
            Every commission is crated to museum standard and shipped fully insured,
            door to door, by our dedicated fine-furniture logistics partners.
          </p>
          <ul className="space-y-2">
            <li className="flex gap-3">
              <span aria-hidden className="text-[hsl(var(--gold))]">✦</span>
              <span>
                <span className="text-foreground">White-glove delivery &amp; installation</span> —
                two-person placement in the room of your choice, unpacking, assembly and full debris removal.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="text-[hsl(var(--gold))]">✦</span>
              <span>
                <span className="text-foreground">Duties &amp; customs handled for you</span> —
                landed-cost quotation confirmed in writing before production begins.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="text-[hsl(var(--gold))]">✦</span>
              <span>
                <span className="text-foreground">Scheduled to your site</span> —
                storage and staged delivery available at no additional handling fee.
              </span>
            </li>
          </ul>
          <p className="text-[12px] text-muted-foreground/80">
            Freight, installation and duties are quoted separately once the destination is confirmed —
            your design advisor will present a single, all-inclusive figure.
          </p>
        </div>
      )}
    </div>
  );
}
