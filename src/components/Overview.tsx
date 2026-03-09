import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { scrollToSection } from "@/lib/scrollToSection";
import { cloudinaryUrl } from "@/lib/cloudinary";

const Overview = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px"
  });

  const scrollToTeam = () => scrollToSection("curating-team");

  return <section id="overview" ref={ref} className="pt-10 md:pt-20 pb-4 md:pb-6 px-4 md:px-12 lg:px-20 bg-muted/30 scroll-mt-24">
      <div className="mx-auto max-w-7xl">
        <motion.div initial={{
        opacity: 0,
        y: 40
      }} animate={isInView ? {
        opacity: 1,
        y: 0
      } : {}} transition={{
        duration: 0.8
      }} className="flex flex-col gap-4 md:gap-10">
          {/* Desktop Row 1: Title+desc left, Stats right */}
          {/* Mobile: Title is order-1, Stats is order-4 */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-6">
            <div className="flex-1 order-1 md:order-1">
              <motion.p initial={{
              opacity: 0
            }} animate={isInView ? {
              opacity: 1
            } : {}} transition={{
              duration: 0.6,
              delay: 0.2
            }} className="mb-2 text-foreground text-xl md:text-2xl lg:text-2xl font-serif font-bold">
                <button
                onClick={() => scrollToSection("gallery")}
                className="hover:text-foreground/70 transition-colors duration-300 cursor-pointer">
                  Gallery Overview
                </button>
              </motion.p>
              
              <motion.h2 initial={{
              opacity: 0,
              y: 20
            }} animate={isInView ? {
              opacity: 1,
              y: 0
            } : {}} transition={{
              duration: 0.8,
              delay: 0.3
            }} className="font-serif text-sm md:text-base lg:text-lg leading-relaxed text-foreground text-justify">A 2,400 sq ft showroom located at 1 Grange Garden, Singapore 249631, where professionals and design connoisseurs can find the perfect pieces they are looking for to elevate their interiors.
              </motion.h2>
            </div>
            
            {/* Stats */}
            <motion.div initial={{
            opacity: 0,
            y: 20
          }} animate={isInView ? {
            opacity: 1,
            y: 0
          } : {}} transition={{
            duration: 0.6,
            delay: 0.4
          }} className="order-5 md:order-2 flex items-start gap-8 md:gap-6 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-border md:pl-6 shrink-0">
               <button
              onClick={() => scrollToSection("sociable-environment")}
              aria-label="View 5 atmospheres in the gallery"
              className="text-left cursor-pointer group transition-all duration-300 hover:scale-105">
                <div className="font-display text-2xl md:text-3xl text-primary animate-text-glow-pulse group-hover:text-accent group-hover:[text-shadow:0_0_12px_hsl(var(--accent)/0.4)] transition-all duration-300" aria-hidden="true">5</div>
                <div className="font-body text-xs uppercase tracking-wider text-primary/80 group-hover:text-accent transition-all duration-300">Atmospheres</div>
              </button>
               <button
              onClick={() => scrollToSection("designers")}
              aria-label="View 50+ designers works and collectible design pieces"
              className="text-left cursor-pointer group transition-all duration-300 hover:scale-105">
                <div className="font-display text-2xl md:text-3xl text-primary animate-text-glow-pulse group-hover:text-accent group-hover:[text-shadow:0_0_12px_hsl(var(--accent)/0.4)] transition-all duration-300" aria-hidden="true">50+</div>
                <div className="font-body text-xs uppercase tracking-wider text-primary/80 group-hover:text-accent transition-all duration-300 leading-tight"><span className="hidden md:inline">Designers works and<br />collectible design pieces<br /><em>in situ</em></span><span className="md:hidden">Designers works and<br />collectible design pieces <em>in situ</em></span></div>
              </button>
            </motion.div>

            {/* Designer names + Gallery overview — order-2 mobile, hidden on desktop */}
            <div className="order-2 md:hidden">
              <motion.p initial={{
              opacity: 0,
              y: 20
            }} animate={isInView ? {
              opacity: 1,
              y: 0
            } : {}} transition={{
              duration: 0.6,
              delay: 0.5
            }} className="font-serif text-sm leading-relaxed text-foreground text-justify">From Jeremy Maxwell Wintrebert and Pierre Bonnefille to Hervé van der Straeten and Thierry Lemaire — a curated venue where design and art congregate. This experiential residence represents a harmonious dialogue between Eastern aesthetics and Western modernism. Each space has been thoughtfully crafted to showcase the interplay of texture, light, and artisanal craftsmanship.</motion.p>
            </div>

            {/* CTA — order-3 mobile, hidden on desktop (shown in row 2) */}
            <div className="order-3 md:hidden">
              <motion.div initial={{
              opacity: 0,
              y: 20
            }} animate={isInView ? {
              opacity: 1,
              y: 0
            } : {}} transition={{
              duration: 0.6,
              delay: 0.6
            }}>
                <button
                  onClick={scrollToTeam}
                  className="group relative flex items-center cursor-pointer transition-all duration-300"
                  aria-label="Meet The Curating Team"
                >
                  <div className="flex -space-x-2 relative z-10 -mr-3">
                    <img
                      src={cloudinaryUrl("IMG_2542_1_kc4fvs", { width: 80, quality: "auto", crop: "fill" })}
                      alt="Cyrille Delval"
                      className="w-12 h-12 rounded-full object-cover border-2 border-[hsl(var(--gold))] shadow-sm group-hover:scale-110 transition-transform duration-300"
                    />
                    <img
                      src={cloudinaryUrl("Screen_Shot_2026-02-26_at_9.59.00_PM_wivwhs", { width: 80, quality: "auto", crop: "fill" })}
                      alt="Elsa Lemarignier"
                      className="w-12 h-12 rounded-full object-cover border-2 border-[hsl(var(--gold))] shadow-sm group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <span className="bg-white hover:bg-white/90 text-foreground border border-[hsl(var(--gold))] shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] group-hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] transition-all duration-300 text-xs rounded-full pl-5 pr-4 py-1.5 font-body">
                    Meet The Curating Team
                  </span>
                </button>
              </motion.div>
            </div>
          </div>
          
          {/* Desktop Row 2: Designer paragraph + CTA side by side */}
          <div className="hidden md:flex md:flex-row gap-8 md:items-start">
            <motion.p initial={{
            opacity: 0,
            y: 20
          }} animate={isInView ? {
            opacity: 1,
            y: 0
          } : {}} transition={{
            duration: 0.6,
            delay: 0.5
          }} className="font-serif text-sm md:text-base leading-relaxed text-foreground text-justify flex-1">From Jeremy Maxwell Wintrebert and Pierre Bonnefille to Hervé van der Straeten and Thierry Lemaire<br />— a curated venue where design and art congregate.</motion.p>

            <motion.div initial={{
            opacity: 0,
            y: 20
          }} animate={isInView ? {
            opacity: 1,
            y: 0
          } : {}} transition={{
            duration: 0.6,
            delay: 0.6
          }} className="shrink-0">
              <button
                onClick={scrollToTeam}
                className="group relative flex items-center cursor-pointer transition-all duration-300"
                aria-label="Meet The Curating Team"
              >
                <div className="flex -space-x-2 relative z-10 -mr-3">
                  <img
                    src={cloudinaryUrl("IMG_2542_1_kc4fvs", { width: 80, quality: "auto", crop: "fill" })}
                    alt="Cyrille Delval"
                    className="w-14 h-14 rounded-full object-cover border-2 border-[hsl(var(--gold))] shadow-sm group-hover:scale-110 transition-transform duration-300"
                  />
                  <img
                    src={cloudinaryUrl("Screen_Shot_2026-02-26_at_9.59.00_PM_wivwhs", { width: 80, quality: "auto", crop: "fill" })}
                    alt="Elsa Lemarignier"
                    className="w-14 h-14 rounded-full object-cover border-2 border-[hsl(var(--gold))] shadow-sm group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <span className="bg-white hover:bg-white/90 text-foreground border border-[hsl(var(--gold))] shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] group-hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] transition-all duration-300 text-sm rounded-full pl-5 pr-4 py-2 font-body">
                  Meet The Curating Team
                </span>
              </button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>;
};
export default Overview;