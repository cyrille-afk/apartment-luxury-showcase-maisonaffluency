import { useState } from "react";
import { Share, Plus, MoreVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface InstallAppDialogProps {
  trigger?: React.ReactNode;
  className?: string;
}

const InstallAppDialog = ({ trigger, className }: InstallAppDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button className={className ?? "font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"}>
            Install App
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Add Maison Affluency to your Home Screen
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground">
            Install our site like an app for instant fullscreen access — no browser bars, faster launch.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-6">
          {/* iPhone */}
          <section>
            <h3 className="font-display text-lg text-foreground mb-3">
              iPhone &amp; iPad (Safari)
            </h3>
            <ol className="space-y-2 font-body text-sm text-foreground/90">
              <li className="flex gap-3">
                <span className="font-display text-accent w-5 shrink-0">1.</span>
                <span>Open <strong>maisonaffluency.com</strong> in <strong>Safari</strong> (not Chrome).</span>
              </li>
              <li className="flex gap-3">
                <span className="font-display text-accent w-5 shrink-0">2.</span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  Tap the <Share className="inline h-4 w-4" /> <strong>Share</strong> icon at the bottom of the screen.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-display text-accent w-5 shrink-0">3.</span>
                <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-display text-accent w-5 shrink-0">4.</span>
                <span>Tap <strong>Add</strong> in the top right corner.</span>
              </li>
            </ol>
          </section>

          {/* Android */}
          <section>
            <h3 className="font-display text-lg text-foreground mb-3">
              Android (Chrome)
            </h3>
            <ol className="space-y-2 font-body text-sm text-foreground/90">
              <li className="flex gap-3">
                <span className="font-display text-accent w-5 shrink-0">1.</span>
                <span>Open <strong>maisonaffluency.com</strong> in <strong>Chrome</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-display text-accent w-5 shrink-0">2.</span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  Tap the <MoreVertical className="inline h-4 w-4" /> <strong>menu</strong> (three dots, top right).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-display text-accent w-5 shrink-0">3.</span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  Tap <Plus className="inline h-4 w-4" /> <strong>Add to Home screen</strong> (or <em>Install app</em>).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-display text-accent w-5 shrink-0">4.</span>
                <span>Confirm with <strong>Install</strong> — the icon will appear on your Home Screen.</span>
              </li>
            </ol>
          </section>

          <p className="font-body text-xs text-muted-foreground border-t border-border pt-4">
            Once installed, launching from the Home Screen icon opens Maison Affluency fullscreen — no address bar, no tabs.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InstallAppDialog;
