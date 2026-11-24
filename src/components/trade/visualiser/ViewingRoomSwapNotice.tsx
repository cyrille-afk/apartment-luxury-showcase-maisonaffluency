import { Info } from "lucide-react";

// One copy for both placements: the grid footnote and the drawer's fixed-collection branch.
export const VIEWING_ROOM_SWAP_NOTICE_TITLE = "Swap options refresh when this page loads";
export const VIEWING_ROOM_SWAP_NOTICE_BODY = "Your advisor chooses which pieces can be swapped. If swapping was enabled for a piece after you opened this room, reload the page to see it. On the published site, recent changes appear after its next republish.";

export default function ViewingRoomSwapNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div role="note" className={`border border-border bg-muted/30 ${compact ? "px-3 py-3" : "p-4"}`}>
      <p className="flex items-center gap-2 font-display text-sm">
        <Info className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        {VIEWING_ROOM_SWAP_NOTICE_TITLE}
      </p>
      <p className={`text-xs leading-relaxed text-muted-foreground ${compact ? "mt-1.5" : "mt-2"}`}>{VIEWING_ROOM_SWAP_NOTICE_BODY}</p>
    </div>
  );
}
