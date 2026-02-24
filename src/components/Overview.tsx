import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

const Overview = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px"
  });

  const scrollToTeam = () => {
    const teamSection = document.getElementById("curating-team");
    if (teamSection) {
      teamSection.scrollIntoView({ behavior: "smooth" });
    }
  };

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
                  onClick={() => {
                    const gallerySection = document.getElementById("gallery");
                    if (gallerySection) {
                      gallerySection.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
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
            }} className="font-display text-base md:text-xl lg:text-2xl leading-tight text-foreground">A{" "}
                <button
                  onClick={() => {
                    const gallerySection = document.getElementById("gallery");
                    if (gallerySection) {
                      gallerySection.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className="inline text-foreground hover:text-foreground/70 underline decoration-foreground/30 hover:decoration-foreground/50 transition-all duration-300 cursor-pointer"
                >
                  2,400 sq ft showroom
                </button>
                {" "}where professionals and design connoisseurs can find the loving pieces they are looking for to elevate their interiors
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
                onClick={() => {
                  const target = document.getElementById("sociable-environment");
                  if (target) {
                    target.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="text-left cursor-pointer group transition-all duration-300 hover:scale-105"
              >
                <div className="font-display text-2xl md:text-3xl text-primary group-hover:text-accent transition-colors duration-300">5</div>
                <div className="font-body text-xs uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-all duration-300">Atmospheres</div>
              </button>
              <button
                onClick={() => {
                  const designersSection = document.getElementById('designers');
                  if (designersSection) {
                    designersSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="text-left cursor-pointer group transition-all duration-300 hover:scale-105"
              >
                <div className="font-display text-2xl md:text-3xl text-primary group-hover:text-accent transition-colors duration-300">50+</div>
                <div className="font-body text-xs uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-all duration-300 leading-tight"><span className="hidden md:inline">Designers works and<br />collectible design pieces<br />in situ</span><span className="md:hidden">Designers works and<br />collectible design pieces in situ</span></div>
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
          }} className="font-body text-sm md:text-base leading-relaxed text-muted-foreground flex-1">This experiential residence represents a harmonious dialogue between Eastern aesthetics and Western modernism. Each space has been thoughtfully crafted to showcase the interplay of texture, light, and artisanal craftsmanship.</motion.p>

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
                className="group bg-white hover:bg-white/90 text-foreground border-2 border-[hsl(var(--gold))] shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] transition-all duration-300 text-sm"
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