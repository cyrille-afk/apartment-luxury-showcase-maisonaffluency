import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface OriginStoryDrawerProps {
  /** The rendered origin line, e.g. "Handcrafted in the US". */
  label: string;
  /** Maker / atelier name used in the copy. */
  maker?: string;
}

/**
 * Turns the origin line into a quiet text link that opens a short drawer on
 * the artisanal manufacturing process behind the piece — context that helps
 * justify the price on mobile, where there is no room for long copy.
 */
export default function OriginStoryDrawer({ label, maker }: OriginStoryDrawerProps) {
  const [open, setOpen] = useState(false);
  const house = maker?.trim() || "the atelier";

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className="text-left underline underline-offset-4 decoration-border hover:text-foreground transition-colors"
        >
          {label}
        </button>
      </DrawerTrigger>
      <DrawerContent className="rounded-t-[2px]">
        <DrawerHeader className="px-5 pt-2 pb-1 text-left">
          <DrawerTitle className="font-display text-lg font-normal">
            {label}
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-5 pb-8 space-y-4 font-body text-sm leading-relaxed text-muted-foreground">
          <p>
            Every piece is made to order by {house}, assembled by hand in a
            small studio rather than on a production line.
          </p>
          <p>
            Metalwork is cut, brazed and hand-finished in-house; glass and
            shades are individually blown or formed, so subtle variation
            between pieces is inherent to the process rather than a defect.
          </p>
          <p>
            Components are hand-polished and plated in small batches, then
            wired, tested and inspected piece by piece before crating for
            white-glove delivery.
          </p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
            Made to order · Lead times reflect handwork, not stock
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
