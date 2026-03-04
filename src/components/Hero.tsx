import { cloudinaryUrl, cloudinarySrcSet } from "@/lib/cloudinary";
import { scrollToSection } from "@/lib/scrollToSection";

// Use a single fallback src (smallest useful size); srcSet handles responsive selection
const HERO_ID = "AffluencySG_194-22.jpg_macpwj";
const heroImageFallback = cloudinaryUrl(HERO_ID, { width: 320, quality: "auto:good", crop: "fill" });
const heroSrcSet = cloudinarySrcSet(HERO_ID, [320, 400, 600, 828, 1200, 1600], { quality: "auto:good", crop: "fill" });

const scrollToOverview = () => scrollToSection("overview");

const Hero = () => {
  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Static image — zero JS dependencies, fastest LCP */}
      <div className="absolute inset-0">
        <img
          src={heroImageFallback}
          srcSet={heroSrcSet}
          sizes="100vw"
          alt="Luxury living room with Asian-inspired murals and designer furniture"
          className="h-full w-full object-cover object-[50%_30%] md:h-[120%] md:object-[50%_0%]"
          loading="eager"
          /* @ts-ignore — React 18 supports fetchPriority */
          fetchPriority="high"
          decoding="sync"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
      </div>

      {/* Text overlay — CSS-only animations, no framer-motion needed */}
      <div className="relative z-10 h-full px-4 pb-32 pt-[45%] md:px-12 md:pb-20 md:pt-[18%] lg:px-20 flex-col border rounded-none opacity-100 shadow-none flex items-start justify-start md:justify-start md:items-start">
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
            <p className="text-lg leading-relaxed text-white text-left font-serif md:text-xl lg:text-2xl font-medium hero-fade-in-delayed-3">
              <span className="hidden md:inline">From Couture Furniture and Collectible Designs <em>in situ</em>,
              <br /> To the World's most distinguished Furniture Houses
              <br /> and Design&nbsp;Workshops</span>
              <span className="md:hidden leading-[2.2] text-justify">From Couture Furniture and Collectible Design <em>in situ</em>,
              <br />To the World's most distinguished
              <br />Furniture Houses and Design&nbsp;Workshops</span>
            </p>

            <div className="mt-16 md:mt-10">
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
