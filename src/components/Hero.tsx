import { useRef, useState, useEffect } from "react";
import { cloudinaryUrl, cloudinarySrcSet } from "@/lib/cloudinary";
const heroImage = cloudinaryUrl("living-room-hero_zxfcxl", { width: 828, quality: "auto:good", crop: "fill" });
const heroSrcSet = cloudinarySrcSet("living-room-hero_zxfcxl", [480, 828, 1200, 1600, 2400], { quality: "auto:good", crop: "fill" });

const Hero = () => {
  const ref = useRef<HTMLElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  return <section ref={ref} className="relative h-screen w-full overflow-hidden">
      {/* Static image container for fastest LCP — no motion wrapper delays */}
      <div className="absolute inset-0">
        <img 
          src={heroImage}
          srcSet={heroSrcSet}
          sizes="100vw"
          alt="Luxury living room with Asian-inspired murals and designer furniture" 
          className="h-full w-full object-cover object-[50%_40%] md:h-[120%] md:object-[50%_0%] will-change-transform"
          style={{ imageRendering: "auto", WebkitBackfaceVisibility: "hidden" }}
          loading="eager"
          fetchPriority="high"
          decoding="sync"
          onLoad={() => setImageLoaded(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
      </div>
      
      <div className="relative z-10 h-full px-4 pb-32 pt-[50%] md:px-12 md:pb-20 md:pt-[18%] lg:px-20 flex-col border rounded-none opacity-100 shadow-none flex items-start justify-start md:justify-start md:items-start">
        <div className="max-w-4xl md:text-left animate-[heroFadeUp_0.8s_ease-out_0.2s_both]">
          <p className="mb-3 uppercase tracking-[0.2em] md:tracking-[0.3em] text-cream/90 font-extrabold font-sans text-sm md:text-xl lg:text-2xl animate-[heroFadeIn_0.6s_ease-out_0.4s_both]">
          </p>
          
          <h1 className="mb-8 md:mb-14 text-3xl leading-tight text-white md:text-5xl font-serif lg:text-6xl cursor-pointer hover:opacity-80 transition-opacity animate-[heroFadeUp_0.8s_ease-out_0.6s_both]" role="button" tabIndex={0} onClick={() => document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" })} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" }); } }}>Discover World Masters in Furniture & Collectible Design
          </h1>
          
          <div className="inline-flex flex-col items-center md:items-end">
            <p className="text-[15px] leading-relaxed text-white text-left font-serif md:text-xl lg:text-2xl font-medium animate-[heroFadeIn_0.6s_ease-out_0.8s_both]">From Couture Furniture and Collectible Designs in Situ,<br /> To the World's most distinguished Furniture Houses<br /> and Artisan&nbsp;Workshops</p>
            
            <div className="mt-10 md:mt-10 md:mr-24 lg:mr-32">
              <div
                className="cursor-pointer animate-[heroBreathe_6s_ease-in-out_infinite]"
                role="button"
                tabIndex={0}
                aria-label="Scroll to gallery"
                onClick={() => document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" })}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" }); } }}
              >
                {/* Inline Gem SVG to avoid loading lucide-react in critical path */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] hover:drop-shadow-[0_0_14px_rgba(255,255,255,0.9)] transition-all" aria-hidden="true">
                  <path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" />
                </svg>
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {/* Photo credit */}
    </section>;
};
export default Hero;