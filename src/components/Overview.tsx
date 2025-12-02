import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
const Overview = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px"
  });
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
          }} className="mb-8 font-display text-4xl leading-tight text-foreground md:text-5xl lg:text-lg">An exclusive showroom where professionals and design connoisseurs can find the loving pieces they are looking for to elevate their interiors.
            <br />
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
                <div className="mb-2 font-display text-3xl text-primary">40</div>
                <div className="font-body text-sm uppercase tracking-wider text-muted-foreground">DESIGNERS</div>
              </div>
              <div>
                <div className="mb-2 font-display text-3xl text-primary">2,400</div>
                <div className="font-body text-sm uppercase tracking-wider text-muted-foreground">
                  Sq Ft
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>;
};
export default Overview;