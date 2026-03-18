import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { cloudinaryUrl } from "@/lib/cloudinary";

const DesignDetails = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px",
  });

  return (
    <section ref={ref} className="pt-16 pb-12 px-4 md:pt-20 md:pb-24 md:px-12 lg:px-20 bg-background">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {/* Compact teaser card */}
          <div className="max-w-3xl mx-auto p-[2px] rounded-sm" style={{ background: 'hsl(36 40% 65%)' }}>
            <Link
              to="/trade/program"
              className="group block overflow-hidden rounded-sm relative aspect-[5/3]"
            >
            <img
              src={cloudinaryUrl("v1773758590/Screen_Shot_2026-03-17_at_10.40.56_PM_mlwtop", { width: 1200, quality: "auto:good", crop: "limit" })}
              alt="Maison Affluency Trade Program — exclusive benefits for architects and interior designers"
              className="w-full h-full object-cover object-bottom group-hover:scale-[1.02] transition-transform duration-700"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] tracking-wide">
                Trade Program
              </h2>
              <p className="font-display text-sm sm:text-base md:text-lg text-white mt-2 sm:mt-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] tracking-widest font-light">
                Exclusive Benefits for Professionals
              </p>
              <span className="mt-6 sm:mt-8 inline-flex items-center gap-2 bg-white/15 group-hover:bg-white/25 backdrop-blur-sm border border-white/30 group-hover:border-white/50 text-white px-5 py-2.5 font-body text-xs uppercase tracking-wider rounded-full transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
                Learn More
              </span>
            </div>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default DesignDetails;
