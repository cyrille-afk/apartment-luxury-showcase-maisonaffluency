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
}} className="mb-4 md:mb-6 text-xl leading-tight text-cream md:text-4xl font-serif lg:text-2xl">Discover world masters in furniture and collectible design
          </motion.h1>
          
          <motion.p initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          duration: 0.6,
          delay: 0.8
        }} className="max-w-2xl text-sm leading-relaxed text-cream/80 text-left md:text-justify font-serif md:text-lg lg:text-xl font-medium mb-6">From Couture Furniture and Collectible Designs to the World's most distinguished Furniture Houses and Artisan Workshops</motion.p>
          
          
        </motion.div>
      </div>

      {/* Photo credit */}
      <p className="absolute bottom-4 right-4 md:bottom-6 md:right-8 z-10 text-[10px] md:text-xs text-cream/50 font-body tracking-wider flex items-center gap-1">
        Photo: <a href="https://www.instagram.com/thanawatchu.maison/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-cream/80 transition-colors"><Instagram className="w-3 h-3" style={{ stroke: "url(#ig-gradient-hero)" }} /><svg width="0" height="0"><defs><linearGradient id="ig-gradient-hero" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f9ce34" /><stop offset="50%" stopColor="#ee2a7b" /><stop offset="100%" stopColor="#6228d7" /></linearGradient></defs></svg>Thanawat Chu</a>
      </p>
      
      <motion.div initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} transition={{
      duration: 1,
      delay: 1.2
    }} className="absolute bottom-32 md:bottom-8 left-1/2 z-10 -translate-x-1/2">
        <button
          onClick={() => document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" })}
          className="flex flex-col items-center gap-2 cursor-pointer group"
        >
          <span className="font-body text-xs uppercase tracking-widest text-cream/80 group-hover:text-cream transition-colors">
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