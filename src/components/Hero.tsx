import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import heroImage from "@/assets/living-room-hero.jpg";

const Hero = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });
  
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.3]);

  return <section ref={ref} className="relative h-screen w-full overflow-hidden">
      <motion.div className="absolute inset-0" style={{ y }}>
        <motion.img 
          src={heroImage} 
          alt="Luxury living room with Asian-inspired murals and designer furniture" 
          className="h-full w-full object-cover object-[50%_40%] md:h-[130%] md:object-center"
          style={{ opacity }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/30" />
      </motion.div>
      
      <div className="relative z-10 h-full px-4 pb-32 pt-32 md:px-12 md:pb-20 md:pt-20 lg:px-20 flex-col border rounded-none opacity-100 shadow-none flex items-start justify-start md:justify-center">
        <motion.div initial={{
        opacity: 0,
        y: 30
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.8,
        delay: 0.2
      }} className="max-w-4xl">
          <motion.p initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          duration: 0.6,
          delay: 0.4
        }} className="mb-3 uppercase tracking-[0.2em] md:tracking-[0.3em] text-cream/90 font-extrabold font-sans text-sm md:text-xl lg:text-2xl">
        </motion.p>
          
          <motion.h1 initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.8,
          delay: 0.6
        }} className="mb-4 md:mb-6 text-xl leading-tight text-cream md:text-4xl font-serif lg:text-2xl">We showcase the best talents of interior design and craftsmanship ​
​<br />
​
          </motion.h1>
          
          <motion.p initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          duration: 0.6,
          delay: 0.8
        }} className="max-w-2xl text-sm leading-relaxed text-cream/80 text-left md:text-justify font-serif md:text-lg lg:text-xl font-medium mb-6">This is a unique opportunity for architects and interior decorators to dazzle their clientele and experience first hand couture furniture, collectibles and artworks from world reknown designers and makers</motion.p>
          
          
        </motion.div>
      </div>
      
      <motion.div initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} transition={{
      duration: 1,
      delay: 1.2
    }} className="absolute bottom-44 md:bottom-8 left-1/2 z-10 -translate-x-1/2">
        <button
          onClick={() => document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" })}
          className="flex flex-col items-center gap-2 cursor-pointer group"
        >
          <span className="font-body text-xs uppercase tracking-widest text-cream/60 group-hover:text-cream/90 transition-colors">
            Scroll to Explore
          </span>
          <motion.div
            className="h-12 w-[1px] bg-gradient-to-b from-cream/60 to-transparent"
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </button>
      </motion.div>
    </section>;
};
export default Hero;