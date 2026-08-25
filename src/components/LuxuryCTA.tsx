import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { trackHeroCta } from "@/lib/analytics";

interface LuxuryCTAProps {
  onClick?: () => void;
  className?: string;
  /** Analytics label for this CTA instance. */
  trackingLabel?: string;
  /** Where the CTA sends the visitor (recorded with the click event). */
  trackingDestination?: string;
}

export default function LuxuryCTA({
  onClick,
  className = "",
  trackingLabel = "hero_explore_collection",
  trackingDestination = "/designers",
}: LuxuryCTAProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Impression: fires once when the CTA is at least half visible.
  useEffect(() => {
    const el = buttonRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            trackHeroCta.impression(trackingLabel);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [trackingLabel]);

  return (
    <div className={`flex flex-col items-start space-y-6 ${className}`}>
      {/* Your Paragraph component with text-shadow stays here */}
      <p
        className="text-white max-w-xl md:max-w-3xl text-sm md:text-xl lg:text-2xl font-serif"
        style={{ textShadow: "0px 2px 8px rgba(0,0,0,0.6)" }}
      >
        A curated collection of masterworks reeditions and contemporary design
        for global architectural projects.
      </p>

      {/* Asymmetric, Right-Shifted CTA Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          trackHeroCta.click(trackingLabel, trackingDestination);
          onClick?.();
        }}
        className="group flex items-center gap-4 border border-white/30 bg-black/10 px-6 py-3.5
                   text-xs font-medium tracking-[0.25em] text-white uppercase backdrop-blur-sm
                   transform translate-x-4 md:translate-x-8
                   transition-all duration-500 ease-out
                   hover:border-white hover:bg-white hover:text-black hover:translate-x-12"
      >
        <span>Explore the Collection</span>
        <ArrowRight className="h-4 w-4 transition-transform duration-500 ease-out group-hover:translate-x-1" />
      </button>
    </div>
  );
}
