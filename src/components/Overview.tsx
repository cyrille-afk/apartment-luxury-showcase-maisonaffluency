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
      }} className="flex flex-col gap-6 md:gap-10">
          {/* Header Row - Title and Stats side by side on mobile */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex-1">
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
            }} className="font-display text-sm md:text-base lg:text-lg leading-tight text-foreground text-justify">A 2,400 sq ft showroom located in Singapore District 9, where professionals and design connoisseurs can find the perfect pieces they are looking for to elevate their interiors
              </motion.h2>
            </div>
            
            {/* Stats - Compact row on mobile */}
            <motion.div initial={{
            opacity: 0,
            y: 20
          }} animate={isInView ? {
            opacity: 1,
            y: 0
          } : {}} transition={{
            duration: 0.6,
            delay: 0.4
          }} className="flex items-start gap-8 md:gap-6 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-border md:pl-6 shrink-0">
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
          </div>
          
          {/* Description and CTA */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-8 md:items-start">
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
                className="group flex items-center gap-3 cursor-pointer transition-all duration-300 hover:opacity-80"
                aria-label="Meet The Curating Team"
              >
                <div className="flex -space-x-3">
                  <img
                    src={cloudinaryUrl("IMG_2542_1_kc4fvs", { width: 80, quality: "auto", crop: "fill" })}
                    alt="Cyrille Delval"
                    className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-background shadow-sm group-hover:scale-105 transition-transform duration-300"
                  />
                  <img
                    src={cloudinaryUrl("Screen_Shot_2026-02-26_at_9.59.00_PM_wivwhs", { width: 80, quality: "auto", crop: "fill" })}
                    alt="Elsa Lemarignier"
                    className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-background shadow-sm group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <span className="font-body text-xs md:text-sm text-muted-foreground group-hover:text-foreground transition-colors duration-300 leading-tight">
                  Meet The<br />Curating Team
                </span>
              </button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>;
};
export default Overview;