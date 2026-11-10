import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { id: string; title: string; open: boolean; side: "left" | "right"; onClose: () => void; children: ReactNode };

export function StudioSidePanel({ id, title, open, side, onClose, children }: Props) {
  return (
    <aside id={id} aria-label={title} aria-hidden={!open} inert={!open}
      className={cn(
        "absolute inset-y-0 z-20 flex min-h-0 w-full flex-col overflow-hidden bg-background transition-transform duration-500 ease-in-out motion-reduce:transition-none",
        side === "left" ? "left-0 border-r border-border lg:w-80" : "right-0 border-l border-border lg:w-[40%]",
        open ? "translate-x-0" : side === "left" ? "-translate-x-full pointer-events-none" : "translate-x-full pointer-events-none",
      )}>
      <div className="shrink-0 border-b border-border p-4 md:px-6">
        <Button type="button" onClick={onClose}
          className="h-10 w-full cursor-pointer rounded-none bg-foreground font-body text-[10px] uppercase tracking-[0.15em] text-background hover:bg-foreground/90">
          <X aria-hidden="true" /> CLOSE {title}
        </Button>
      </div>
      {children}
    </aside>
  );
}
