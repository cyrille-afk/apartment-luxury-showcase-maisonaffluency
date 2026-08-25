import { ArrowRight } from "lucide-react";

export default function LuxuryCTA() {
  return (
    <div className="flex flex-col items-start space-y-6">
      <p
        className="text-white max-w-xl text-lg"
        style={{ textShadow: "0px 2px 8px rgba(0,0,0,0.6)" }}
      >
        A curated collection of masterworks reeditions and contemporary design
        for global architectural projects.
      </p>

      <button
        className="group flex items-center gap-4 border border-white/20 bg-white/5 px-6 py-3.5
                   text-[11px] font-medium tracking-[0.25em] text-white uppercase backdrop-blur-sm
                   transform translate-x-4 md:translate-x-8
                   transition-all duration-500 ease-out
                   hover:border-white hover:bg-white hover:text-black hover:translate-x-12"
      >
        <span>EXPLORE THE COLLECTION</span>
        <span className="inline-block transition-transform duration-500 ease-out group-hover:translate-x-1.5">→</span>
      </button>
    </div>
  );
}

