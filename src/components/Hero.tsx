import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";

import { cloudinaryUrl, cloudinarySrcSet } from "@/lib/cloudinary";
// Use a single fallback src (smallest useful size); srcSet handles responsive selection
const heroImageFallback = cloudinaryUrl("living-room-hero_zxfcxl", { width: 400, quality: "auto:good", crop: "fill" });
const heroSrcSet = cloudinarySrcSet("living-room-hero_zxfcxl", [400, 600, 828, 1200, 1600], { quality: "auto:good", crop: "fill" });

const Hero = () => {
  const ref = useRef<HTMLElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });
  
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.3]);

  return <section ref={ref} className="relative h-screen w-full overflow-hidden">
      {/* Static image container for fastest LCP — no motion wrapper delays */}
      <div className="absolute inset-0">
        <img 
          src={heroImageFallback}
          srcSet={heroSrcSet}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 100vw"
          alt="Luxury living room with Asian-inspired murals and designer furniture" 
          className="h-full w-full object-cover object-[50%_40%] md:h-[120%] md:object-[50%_0%] will-change-transform"
          style={{ imageRendering: "auto", WebkitBackfaceVisibility: "hidden" }}
          loading="eager"
          fetchPriority="high"
          decoding="sync"
          onLoad={() => setImageLoaded(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
      </div>
      
      <div className="relative z-10 h-full px-4 pb-32 pt-[50%] md:px-12 md:pb-20 md:pt-[18%] lg:px-20 flex-col border rounded-none opacity-100 shadow-none flex items-start justify-start md:justify-start md:items-start">
        <motion.div initial={{
        opacity: 0,
        y: 30
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.8,
        delay: 0.2
      }} className="max-w-4xl md:text-left">
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
}} className="mb-8 md:mb-14 text-3xl leading-tight text-white md:text-5xl font-serif lg:text-6xl cursor-pointer hover:opacity-80 transition-opacity" role="button" tabIndex={0} onClick={() => document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" })} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" }); } }}>Discover World Masters in Furniture & Collectible Design
          </motion.h1>
          
          <div className="inline-flex flex-col items-center md:items-end">
            <motion.p initial={{
              opacity: 0
            }} animate={{
              opacity: 1
            }} transition={{
              duration: 0.6,
              delay: 0.8
            }} className="text-[15px] leading-relaxed text-white text-left font-serif md:text-xl lg:text-2xl font-medium">From Couture Furniture and Collectible Designs in Situ,<br /> To the World's most distinguished Furniture Houses<br /> and Artisan&nbsp;Workshops</motion.p>
            
            <div className="mt-8 md:mt-10">
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1 }}
                onClick={() => document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" })}
                className="px-6 py-3 md:px-8 md:py-3.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/30 hover:border-white/50 text-white text-sm md:text-base font-serif tracking-wide rounded-full transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_30px_rgba(0,0,0,0.25)]"
              >
                Explore the Collection
              </motion.button>
            </div>
          </div>
          
        </motion.div>
      </div>

      {/* Photo credit */}
    </section>;
};
export default Hero;