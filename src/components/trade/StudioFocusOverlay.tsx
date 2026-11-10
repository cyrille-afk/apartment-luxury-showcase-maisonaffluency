import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: { name: string; image_url: string | null } | null;
  dimensions: string;
  children: ReactNode;
};

export function StudioFocusOverlay({ open, onOpenChange, item, dimensions, children }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose aria-describedby={undefined}
        overlayClassName="bg-background/60 backdrop-blur-md motion-reduce:animate-none"
        className="flex h-[92dvh] w-[calc(100%-2rem)] max-w-[1500px] flex-col gap-0 overflow-hidden rounded-none p-0 sm:rounded-none motion-reduce:animate-none">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 md:px-8">
          <DialogTitle className="font-body text-[11px] font-normal uppercase tracking-[0.15em] text-muted-foreground">Visual studio</DialogTitle>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-auto min-h-10 rounded-none font-body text-[10px] uppercase tracking-[0.15em]">
            <X aria-hidden="true" /> Close Visual Studio
          </Button>
        </div>
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
          <figure className="flex min-w-0 flex-col items-center justify-center border-b border-border p-6 md:p-10 lg:border-b-0 lg:border-r">
            {item?.image_url ? <img src={item.image_url} alt={item.name} className="h-[32dvh] w-full object-contain lg:h-[58dvh]" /> : <div className="h-[32dvh]" />}
            <figcaption className="mt-6 space-y-3 text-center">
              <p className="font-display text-2xl text-foreground md:text-3xl">{item?.name}</p>
              <p className="font-body text-[10px] uppercase leading-relaxed tracking-[0.15em] text-muted-foreground">{dimensions}</p>
            </figcaption>
          </figure>
          <div className="flex min-h-0 min-w-0 flex-col lg:overflow-hidden">{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}