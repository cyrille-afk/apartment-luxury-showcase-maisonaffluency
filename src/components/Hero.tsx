import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Instagram, Gem } from "lucide-react";
import { cloudinaryUrl, cloudinarySrcSet } from "@/lib/cloudinary";
const heroImage = cloudinaryUrl("living-room-hero_zxfcxl", { width: 828, quality: "auto:good", crop: "fill" });
const heroSrcSet = cloudinarySrcSet("living-room-hero_zxfcxl", [480, 828, 1200, 1600, 2400], { quality: "auto:good", crop: "fill" });

const Hero = () => {
  const ref = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });
  
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.3]);

  return <section ref={ref} className="relative h-screen w-full overflow-hidden">
      <motion.div className="absolute inset-0" style={isMobile ? {} : { y }}>
        <img 
          src={heroImage}
          srcSet={heroSrcSet}
          sizes="100vw"
          alt="Luxury living room with Asian-inspired murals and designer furniture" 
          className="h-full w-full object-cover object-[50%_40%] md:h-[120%] md:object-[50%_0%] will-change-transform"
          style={{ imageRendering: "auto", WebkitBackfaceVisibility: "hidden" }}
          loading="eager"
          fetchPriority="high"
          decoding="sync"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
      </motion.div>
      
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
}} className="mb-8 md:mb-14 text-3xl leading-tight text-white md:text-5xl font-serif lg:text-6xl cursor-pointer hover:opacity-80 transition-opacity" onClick={() => document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" })}>Discover World Masters in Furniture & Collectible Design
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
            
            <div className="mt-10 md:mt-10 md:mr-24 lg:mr-32">
              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="cursor-pointer"
                onClick={() => document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Gem className="w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] hover:drop-shadow-[0_0_14px_rgba(255,255,255,0.9)] transition-all" />
              </motion.div>
            </div>
          </div>
          
        </motion.div>
      </div>

      {/* Photo credit */}
    </section>;
};
export default Hero;