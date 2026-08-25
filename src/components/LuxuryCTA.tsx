import { ArrowRight } from "lucide-react";

interface LuxuryCTAProps {
  onExplore: () => void;
}

export default function LuxuryCTA({ onExplore }: LuxuryCTAProps) {
  return (
    <div className="flex flex-col items-start space-y-6">
      <p
        className="max-w-xl text-lg text-white"
        style={{ textShadow: "0px 2px 8px rgba(0,0,0,0.6)" }}
      >
        A curated collection of masterworks reeditions and contemporary design
        for global architectural projects.
      </p>

      <button
        type="button"
        onClick={onExplore}
        className="group flex translate-x-4 items-center gap-4 border border-white/30 bg-black/10 px-6 py-3.5 text-xs font-medium uppercase tracking-[0.25em] text-white backdrop-blur-sm transition-all duration-500 ease-out hover:translate-x-12 hover:border-white hover:bg-white hover:text-black md:translate-x-8"
      >
        <span>Explore the Collection</span>
        <ArrowRight className="h-4 w-4 transition-transform duration-500 ease-out group-hover:translate-x-1" />
      </button>
    </div>
  );
}

