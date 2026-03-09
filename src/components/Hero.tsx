import { cloudinaryUrl, cloudinarySrcSet } from "@/lib/cloudinary";
import { scrollToSection } from "@/lib/scrollToSection";
import { trackCTA } from "@/lib/analytics";

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
      <div className="relative z-10 h-full px-4 pb-32 pt-[34%] md:px-32 md:pb-20 md:pt-[14%] lg:px-52 flex-col border rounded-none opacity-100 shadow-none flex items-start justify-start md:justify-start md:items-start">
        <div className="max-w-4xl md:text-left hero-fade-in">
          <p className="mb-3 uppercase tracking-[0.2em] md:tracking-[0.3em] text-cream/90 font-extrabold font-sans text-sm md:text-xl lg:text-2xl hero-fade-in-delayed-1">
          </p>

          <h1 className="mb-8 md:mb-14 text-3xl leading-tight text-white md:text-4xl font-serif lg:text-5xl hero-fade-in-delayed-2">
            <button
              type="button"
              onClick={scrollToOverview}
              className="text-left text-inherit font-inherit leading-inherit cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0 m-0"
            >
              Discover The World's Best Interior Designers' Iconic Pieces
            </button>
          </h1>

          <div className="inline-flex flex-col items-center md:items-end">
            <p className="text-base leading-relaxed text-white text-left font-serif md:text-xl lg:text-2xl font-medium hero-fade-in-delayed-3">
              <span className="hidden md:inline">From Couture Furniture and Collectible Designs Items,
              <br /> Discover Emerging Talents and Design Masters In Our Gallery
              <br /> or Through the Best Ateliers and Designer Workshops We Partner&nbsp;With</span>
              <span className="md:hidden leading-[2.2] text-justify">From Couture Furniture and Collectible
              <br />Designs Items, Discover Emerging Talents
              <br />and Design Masters In Our Gallery
              <br />or Through the Best Ateliers
              <br />and Designer Workshops We Partner&nbsp;With</span>
            </p>

            <div className="mt-16 md:mt-16 flex flex-col items-start md:items-center gap-6">
              <button
                onClick={scrollToOverview}
                className="flex items-center gap-2 px-6 py-3 md:px-10 md:py-4 lg:px-12 lg:py-4.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm md:backdrop-blur-xl border border-white/30 hover:border-white/50 text-white text-sm md:text-lg font-body font-bold tracking-wide rounded-full transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_30px_rgba(0,0,0,0.25)] hero-fade-in-delayed-4"
              >
                Explore Our Curated Collection
              </button>

            </div>
          </div>
        </div>
      </div>

      {/* Mobile: bottom-right of hero, vertical stack, above iOS bar & Chat widget */}
      <div
        className="flex md:hidden absolute right-4 z-20 flex-col items-end gap-2 hero-fade-in-delayed-4"
        style={{ bottom: "max(9.5rem, calc(env(safe-area-inset-bottom) + 9rem))", animationDelay: "1.2s" }}
      >
        <button
          onClick={() => { trackCTA.bookAppointment("HeroCTA"); scrollToSection("contact"); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/30 hover:border-white/50 text-white text-xs font-body font-bold tracking-wide rounded-full transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
        >
          Book a Viewing
        </button>
        <button
          onClick={() => scrollToSection("details")}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/30 hover:border-white/50 text-white text-xs font-body font-bold tracking-wide rounded-full transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
        >
          Trade Program
        </button>
      </div>

      {/* Desktop: bottom-right of hero, next to Chat widget */}
      <div
        className="hidden md:flex absolute bottom-6 z-20 items-center gap-2 hero-fade-in-delayed-4"
        style={{ right: "200px", animationDelay: "1.2s" }}
      >
        <button
          onClick={() => { trackCTA.bookAppointment("HeroCTA"); scrollToSection("contact"); }}
          className="flex items-center gap-2 px-5 py-2.5 lg:px-6 lg:py-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/25 hover:border-white/45 text-white text-xs lg:text-sm font-body font-bold tracking-wide rounded-full transition-all duration-300 shadow-lg"
        >
          Book a Viewing
        </button>
        <button
          onClick={() => scrollToSection("details")}
          className="flex items-center gap-2 px-5 py-2.5 lg:px-6 lg:py-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/25 hover:border-white/45 text-white text-xs lg:text-sm font-body font-bold tracking-wide rounded-full transition-all duration-300 shadow-lg"
        >
          Trade Program
        </button>
      </div>
    </section>
  );
};
export default Hero;