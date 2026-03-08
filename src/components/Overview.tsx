import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { scrollToSection } from "@/lib/scrollToSection";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

const Overview = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px"
  });

  const scrollToTeam = () => scrollToSection("curating-team");

  return <section id="overview" ref={ref} className="py-10 md:py-20 pb-6 md:pb-10 px-4 md:px-12 lg:px-20 bg-muted/30 scroll-mt-24">
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
                  className="hover:text-foreground/70 transition-colors duration-300 cursor-pointer"
                >
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
            }} className="font-display text-base md:text-xl lg:text-2xl leading-tight text-foreground">A 2,400 sq ft showroom located in Singapore District 9, where professionals and design connoisseurs can find the loving pieces they are looking for to elevate their interiors
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
                className="text-left cursor-pointer group transition-all duration-300 hover:scale-105"
              >
                <div className="font-display text-2xl md:text-3xl text-primary animate-text-glow-pulse group-hover:text-accent group-hover:[text-shadow:0_0_12px_hsl(var(--accent)/0.4)] transition-all duration-300" aria-hidden="true">5</div>
                <div className="font-body text-xs uppercase tracking-wider text-primary/80 group-hover:text-accent transition-all duration-300">Atmospheres</div>
              </button>
               <button
                onClick={() => scrollToSection("designers")}
                aria-label="View 50+ designers works and collectible design pieces"
                className="text-left cursor-pointer group transition-all duration-300 hover:scale-105"
              >
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
          }} className="font-body text-sm md:text-base leading-relaxed text-muted-foreground flex-1">This experiential residence represents a harmonious dialogue between Eastern aesthetics and Western modernism.<br className="hidden md:block" /> Each space has been thoughtfully crafted to showcase the interplay of texture, light, and artisanal craftsmanship.</motion.p>

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
              <Button 
                onClick={scrollToTeam}
                className="group bg-white hover:bg-white/90 text-foreground border border-[hsl(var(--gold))] shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] transition-all duration-300 text-sm rounded-full px-6 py-2"
              >
                <Users className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
                <span className="font-body">Meet The Curating Team</span>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>;
};
export default Overview;