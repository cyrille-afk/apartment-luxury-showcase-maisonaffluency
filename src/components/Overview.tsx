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

  return <section ref={ref} className="py-24 px-6 md:px-12 lg:px-20 bg-background">
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
          }} className="mb-3 uppercase tracking-[0.3em] text-primary text-xl font-serif">OVERVIEW</motion.p>
            
            <motion.h2 initial={{
            opacity: 0,
            y: 20
          }} animate={isInView ? {
            opacity: 1,
            y: 0
          } : {}} transition={{
            duration: 0.8,
            delay: 0.3
          }} className="mb-8 font-display text-4xl leading-tight text-foreground md:text-5xl lg:text-base">An exclusive showroom where professionals and design connoisseurs can find the loving pieces they are looking for to elevate their interiors
​<br />
              ​
            </motion.h2>
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
          }} className="grid grid-cols-3 gap-6 pt-8 border-t border-border">
              <div>
                <div className="mb-2 font-display text-3xl text-primary">5</div>
                <div className="font-body text-sm uppercase tracking-wider text-muted-foreground">ATMOSPHERES</div>
              </div>
              <div>
                <div className="mb-2 font-display text-3xl text-primary">50</div>
                <div className="font-body text-sm uppercase tracking-wider text-muted-foreground">DESIGNERS</div>
              </div>
              <div>
                <div className="mb-2 font-display text-3xl text-primary">2,400</div>
                <div className="font-body text-sm uppercase tracking-wider text-muted-foreground">
                  Sq Ft
                </div>
              </div>
            </motion.div>

            <motion.div initial={{
            opacity: 0,
            y: 20
          }} animate={isInView ? {
            opacity: 1,
            y: 0
          } : {}} transition={{
            duration: 0.6,
            delay: 0.7
          }} className="pt-8">
              <Button 
                onClick={scrollToTeam}
                variant="outline"
                className="group border-primary/30 hover:border-primary hover:bg-primary/5 transition-all duration-300"
              >
                <Users className="mr-2 h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                <span className="font-body">Meet Our Team</span>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>;
};
export default Overview;