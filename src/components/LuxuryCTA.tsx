import { ArrowRight } from "lucide-react";

interface LuxuryCTAProps {
  onClick?: () => void;
  className?: string;
}

export default function LuxuryCTA({ onClick, className = "" }: LuxuryCTAProps) {
  return (
    <div className={`flex flex-col items-start space-y-6 ${className}`}>
      {/* Your Paragraph component with text-shadow stays here */}
      <p
        className="text-white max-w-xl text-lg"
        style={{ textShadow: "0px 2px 8px rgba(0,0,0,0.6)" }}
      >
        A curated collection of masterworks reeditions and contemporary design
        for global architectural projects.
      </p>

      {/* Asymmetric, Right-Shifted CTA Button */}
      <button
        type="button"
        onClick={onClick}
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
