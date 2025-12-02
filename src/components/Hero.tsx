import { motion } from "framer-motion";
import heroImage from "@/assets/living-room-hero.jpg";
const Hero = () => {
  return <section className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroImage} alt="Luxury living room with Asian-inspired murals and designer furniture" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/30" />
      </div>
      
      <div className="relative z-10 h-full px-4 pb-16 pt-20 md:px-12 md:pb-20 lg:px-20 flex-col border rounded-none flex items-start justify-center opacity-100 shadow-none">
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
        }} className="mb-4 md:mb-6 text-2xl leading-tight text-cream md:text-4xl font-serif lg:text-2xl">We showcase the best talents of interior design and craftsmanship ​
          <br />
              ​
          </motion.h1>
          
          <motion.p initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          duration: 0.6,
          delay: 0.8
        }} className="max-w-2xl text-base leading-relaxed text-cream/80 text-left md:text-justify font-medium font-serif md:text-lg lg:text-xl"> This is a unique opportunity for architects and interior decorators to dazzle their clientele and experience first hand couture furniture, collectibles and artworks from world reknown designers and makers.</motion.p>
        </motion.div>
      </div>
      
      <motion.div initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} transition={{
      duration: 1,
      delay: 1.2
    }} className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <div className="flex flex-col items-center gap-2">
          <span className="font-body text-xs uppercase tracking-widest text-cream/60">
            Scroll to Explore
          </span>
          <div className="h-12 w-[1px] bg-gradient-to-b from-cream/60 to-transparent" />
        </div>
      </motion.div>
    </section>;
};
export default Hero;