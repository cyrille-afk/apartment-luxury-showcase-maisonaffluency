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

  return <section id="overview" ref={ref} className="py-12 md:py-24 px-6 md:px-12 lg:px-20 bg-background">
      <div className="mx-auto max-w-7xl">
        <motion.div initial={{
        opacity: 0,
        y: 40
      }} animate={isInView ? {
        opacity: 1,
        y: 0
      } : {}} transition={{
        duration: 0.8
      }} className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <motion.p initial={{
            opacity: 0
          }} animate={isInView ? {
            opacity: 1
          } : {}} transition={{
            duration: 0.6,
            delay: 0.2
          }} className="mb-3 uppercase tracking-[0.3em] text-primary text-base md:text-xl font-serif">OVERVIEW</motion.p>
            
            <motion.h2 initial={{
            opacity: 0,
            y: 20
          }} animate={isInView ? {
            opacity: 1,
            y: 0
          } : {}} transition={{
            duration: 0.8,
            delay: 0.3
          }} className="mb-8 font-display text-xl leading-tight text-foreground md:text-2xl lg:text-3xl">An{" "}
              <button
                onClick={() => {
                  const gallerySection = document.getElementById("gallery");
                  if (gallerySection) {
                    gallerySection.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="inline text-primary hover:text-accent underline decoration-primary/30 hover:decoration-accent transition-all duration-300 cursor-pointer"
              >
                exclusive 2,400 sq ft showroom / gallery
              </button>
              {" "}where professionals and design connoisseurs can find the loving pieces they are looking for to elevate their interiors
            </motion.h2>

            <motion.div initial={{
            opacity: 0,
            y: 20
          }} animate={isInView ? {
            opacity: 1,
            y: 0
          } : {}} transition={{
            duration: 0.6,
            delay: 0.4
          }}>
              <Button 
                onClick={scrollToTeam}
                className="group bg-white hover:bg-white/90 text-foreground border-2 border-[hsl(var(--gold))] shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] transition-all duration-300"
              >
                <Users className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
                <span className="font-body">Meet The Curating Team</span>
              </Button>
            </motion.div>
          </div>
          
          <div className="space-y-6">
            <motion.p initial={{
            opacity: 0,
            y: 20
          }} animate={isInView ? {
            opacity: 1,
            y: 0
          } : {}} transition={{
            duration: 0.6,
            delay: 0.4
          }} className="font-body text-lg leading-relaxed text-muted-foreground">This experiential residence represents a harmonious dialogue between Eastern aesthetics and Western modernism. Each space has been thoughtfully crafted to showcase the interplay of texture, light, and artisanal craftsmanship.</motion.p>
            
            <motion.p initial={{
            opacity: 0,
            y: 20
          }} animate={isInView ? {
            opacity: 1,
            y: 0
          } : {}} transition={{
            duration: 0.6,
            delay: 0.5
          }} className="font-body text-lg leading-relaxed text-muted-foreground">
              From hand-painted murals that transport viewers to serene landscapes, to
              sculptural furniture pieces that challenge conventional forms, every element
              serves both aesthetic and functional purposes.
            </motion.p>
            
            <motion.div initial={{
            opacity: 0,
            y: 20
          }} animate={isInView ? {
            opacity: 1,
            y: 0
          } : {}} transition={{
            duration: 0.6,
            delay: 0.6
          }} className="grid grid-cols-2 gap-6 pt-8 border-t border-border">
              <button 
                onClick={() => {
                  const gallerySection = document.getElementById("gallery");
                  if (gallerySection) {
                    gallerySection.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="text-left cursor-pointer group transition-all duration-300 hover:scale-105 hover:-translate-y-1"
              >
                <div className="mb-2 font-display text-3xl text-primary group-hover:text-accent transition-colors duration-300">5</div>
                <div className="font-body text-sm uppercase tracking-wider text-muted-foreground underline decoration-primary/30 group-hover:decoration-accent group-hover:text-foreground transition-all duration-300">ATMOSPHERES</div>
              </button>
              <button
                onClick={() => {
                  const designersSection = document.getElementById('featured-designers');
                  if (designersSection) {
                    designersSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="text-left cursor-pointer group transition-all duration-300 hover:scale-105 hover:-translate-y-1"
              >
                <div className="mb-2 font-display text-3xl text-primary group-hover:text-accent transition-colors duration-300">50</div>
                <div className="font-body text-sm uppercase tracking-wider text-muted-foreground underline decoration-primary/30 group-hover:decoration-accent group-hover:text-foreground transition-all duration-300">DESIGNERS</div>
              </button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>;
};
export default Overview;