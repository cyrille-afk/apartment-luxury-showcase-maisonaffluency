import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Instagram } from "lucide-react";
import { cloudinaryUrl, cloudinarySrcSet } from "@/lib/cloudinary";
const heroImage = cloudinaryUrl("living-room-hero_zxfcxl", { width: 1600, quality: "auto:good", crop: "fill" });
const heroSrcSet = cloudinarySrcSet("living-room-hero_zxfcxl", [640, 828, 1200, 1600, 2400], { quality: "auto:good", crop: "fill" });

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
        <motion.img 
          src={heroImage}
          srcSet={heroSrcSet}
          sizes="100vw"
          alt="Luxury living room with Asian-inspired murals and designer furniture" 
          className="h-full w-full object-cover object-[50%_40%] md:h-[130%] md:object-[50%_30%] will-change-transform"
          style={{ opacity, imageRendering: "auto", WebkitBackfaceVisibility: "hidden" }}
          loading="eager"
          fetchPriority="high"
          decoding="sync"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
      </motion.div>
      
      <div className="relative z-10 h-full px-4 pb-32 pt-[85%] md:px-12 md:pb-20 md:pt-[35%] lg:px-20 flex-col border rounded-none opacity-100 shadow-none flex items-start justify-start md:justify-center md:items-center">
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
}} className="mb-4 md:mb-6 text-3xl leading-tight text-white md:text-5xl font-serif lg:text-6xl">Discover World Masters in Furniture & Collectible Design
          </motion.h1>
          
          <motion.p initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          duration: 0.6,
          delay: 0.8
        }} className="max-w-3xl text-base leading-relaxed text-white text-left font-serif md:text-xl lg:text-2xl font-medium mb-6 mt-2 md:mt-4">From Couture Furniture and Collectible Designs in Situ,<br /> To the World's most distinguished Furniture Houses and Artisan&nbsp;Workshops</motion.p>
          
          <motion.div initial={{
            opacity: 0
          }} animate={{
            opacity: 1
          }} transition={{
            duration: 1,
            delay: 1.2
          }} className="mt-6 md:mt-8 w-full flex justify-center">
            <button
              onClick={() => document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" })}
              className="flex flex-col items-center gap-2 cursor-pointer group"
            >
              <span className="font-body text-sm md:text-base uppercase tracking-widest text-white group-hover:text-white/80 transition-colors">
                Scroll to Explore
              </span>
              <motion.div
                className="h-12 w-[1px] bg-gradient-to-b from-white/60 to-transparent"
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </button>
          </motion.div>
          
        </motion.div>
      </div>

      {/* Photo credit */}
    </section>;
};
export default Hero;