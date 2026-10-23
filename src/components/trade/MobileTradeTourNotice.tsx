import { Monitor } from "lucide-react";
import { useAIGuideName } from "@/hooks/useAIGuideName";
import { useDesktopTradeTour } from "./useDesktopTradeTour";

export function MobileTradeTourNotice() {
  const desktop = useDesktopTradeTour();
  const name = useAIGuideName();
  if (desktop) return null;
  return (
    <div role="note" aria-label="Desktop onboarding tour" className="mt-4 flex items-start gap-3 border-l-2 border-accent bg-muted px-4 py-3">
      <Monitor aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <p className="font-body text-xs leading-relaxed text-muted-foreground">
        The onboarding tour is available on desktop only. Sign in on your computer and select <strong className="font-medium text-foreground">Meet {name}</strong> below Welcome on your dashboard to play it.
      </p>
    </div>
  );
}