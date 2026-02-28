import { useRef, useEffect } from "react";
import { cloudinaryUrl, cloudinarySrcSet } from "@/lib/cloudinary";
import { scrollToSection } from "@/lib/scrollToSection";

// Use a single fallback src (smallest useful size); srcSet handles responsive selection
const heroImageFallback = cloudinaryUrl("living-room-hero_zxfcxl", { width: 320, quality: "auto:good", crop: "fill" });
const heroSrcSet = cloudinarySrcSet("living-room-hero_zxfcxl", [320, 400, 600, 828, 1200], { quality: "auto:good", crop: "fill" });

const scrollToOverview = () => scrollToSection("overview");

const Hero = () => {
  const ref = useRef<HTMLElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Set fetchpriority as a native attribute to avoid React 18 warning
  useEffect(() => {
    imgRef.current?.setAttribute("fetchpriority", "high");
  }, []);
  return (
    <section ref={ref} className="relative h-screen w-full overflow-hidden">
      {/* Static image — zero JS dependencies, fastest LCP */}
      <div className="absolute inset-0">
        <img
          ref={imgRef}
          src={heroImageFallback}
          srcSet={heroSrcSet}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 100vw"
          alt="Luxury living room with Asian-inspired murals and designer furniture"
          className="h-full w-full object-cover object-[50%_40%] md:h-[120%] md:object-[50%_0%]"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
      </div>

      {/* Text overlay — CSS-only animations, no framer-motion needed */}
      <div className="relative z-10 h-full px-4 pb-32 pt-[50%] md:px-12 md:pb-20 md:pt-[18%] lg:px-20 flex-col border rounded-none opacity-100 shadow-none flex items-start justify-start md:justify-start md:items-start">
        <div className="max-w-4xl md:text-left hero-fade-in">
          <p className="mb-3 uppercase tracking-[0.2em] md:tracking-[0.3em] text-cream/90 font-extrabold font-sans text-sm md:text-xl lg:text-2xl hero-fade-in-delayed-1">
          </p>

          <h1 className="mb-8 md:mb-14 text-3xl leading-tight text-white md:text-5xl font-serif lg:text-6xl hero-fade-in-delayed-2">
            <button
              type="button"
              onClick={scrollToOverview}
              className="text-left text-inherit font-inherit leading-inherit cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0 m-0"
            >
              Discover World Masters in Furniture &amp; Collectible Design
            </button>
          </h1>

          <div className="inline-flex flex-col items-center md:items-end">
            <p className="text-[15px] leading-relaxed text-white text-left font-serif md:text-xl lg:text-2xl font-medium hero-fade-in-delayed-3">
              From Couture Furniture and Collectible Designs in Situ,
              <br /> To the World's most distinguished Furniture Houses
              <br /> and Artisan&nbsp;Workshops
            </p>

            <div className="mt-8 md:mt-10">
              <button
                onClick={scrollToOverview}
                className="px-6 py-3 md:px-8 md:py-3.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/30 hover:border-white/50 text-white text-sm md:text-base font-serif tracking-wide rounded-full transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_30px_rgba(0,0,0,0.25)] hero-fade-in-delayed-4"
              >
                Explore Our Curation
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default Hero;
