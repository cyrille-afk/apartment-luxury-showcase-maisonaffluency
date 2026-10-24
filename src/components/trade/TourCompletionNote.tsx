import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { consumeTourCompletion, tourCompletionWasClaimed } from "@/components/trade/felixTourUtils";

/**
 * One-line confirmation that the walkthrough ended and the member is home.
 * The tour marks completion when it finishes; the note claims that marker once
 * (a refresh does not repeat it) and the ✕ drops it for the rest of the visit.
 */
export const TourCompletionNote = () => {
  const [shown, setShown] = useState(() => consumeTourCompletion() || tourCompletionWasClaimed());
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const sync = () => {
      if (consumeTourCompletion() || tourCompletionWasClaimed()) setShown(true);
    };
    window.addEventListener("felix-tour:state", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("felix-tour:state", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!shown) return;
    const raf = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(raf);
  }, [shown]);

  if (!shown) return null;

  return (
    <div
      role="status"
      className={`mb-8 md:mb-10 flex items-center gap-3 border-b border-border pb-5 md:pb-6 transition-all duration-500 ease-out ${settled ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
    >
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--felix-bronze-deep)/0.4)]"
      >
        <Check className="h-3 w-3 text-[hsl(var(--felix-bronze-ink))]" />
      </span>
      <p className="min-w-0 flex-1 font-display text-[15px] italic leading-snug text-foreground md:text-base">
        You&rsquo;re all set — the walkthrough is complete and your dashboard is ready.
      </p>
      <button
        type="button"
        onClick={() => setShown(false)}
        aria-label="Dismiss confirmation"
        className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        <X aria-hidden className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default TourCompletionNote;
