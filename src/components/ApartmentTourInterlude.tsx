import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Share2, Play, Check, Copy } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

const VIDEO_URL = "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/videos/apartment-tour-voiceover.mp4";
const POSTER_URL = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1600,q_auto:good,c_fill,g_auto/bespoke-sofa_gxidtx";

const ApartmentTourInterlude = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMobile = useIsMobile();

  const handlePlay = () => {
    setIsPlaying(true);
    setTimeout(() => {
      videoRef.current?.play();
    }, 100);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/apartment-tour-og.html`;
    const text = `A Private Apartment Tour — Maison Affluency Singapore\n${shareUrl}`;

    if (isMobile) {
      const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(wa, "_blank", "noopener");
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Link copied — paste it into WhatsApp or any app");
      } catch {
        toast.error("Could not copy link");
      }
    }
  };

  return (
    <section ref={ref} id="apartment-tour" className="pt-8 md:pt-12 pb-2 md:pb-4 bg-white scroll-mt-32">
      <div className="mx-auto max-w-6xl px-4 md:px-12 lg:px-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          {/* Header */}
          <div className="flex flex-col mb-6 md:mb-10">
            <p className="text-[11px] md:text-[12px] tracking-[0.3em] uppercase text-muted-foreground/60 mb-3 font-light font-body">
              Maison Affluency · Singapore
            </p>
            <h2 className="font-serif text-xl md:text-3xl lg:text-4xl text-foreground font-light tracking-wide">
              Tour Our Gallery
            </h2>
            <h3 className="font-serif text-lg md:text-xl text-muted-foreground font-light tracking-wide mt-1">
              & Meet the Curating Team
            </h3>
            <p className="text-muted-foreground text-xs md:text-sm tracking-[0.1em] mt-3 font-light font-body max-w-xl">
              An exclusive cinematic tour of a bespoke Singapore apartment — collectible furniture, artisan craftsmanship, and panoramic cityscape views.
            </p>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 text-[11px] font-body text-muted-foreground hover:text-primary transition-colors mt-3"
              aria-label="Share apartment tour"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
          </div>

          {/* Video player */}
          <div className="relative w-full overflow-hidden rounded-sm shadow-2xl" style={{ aspectRatio: "16/9" }}>
            {!isPlaying ? (
              <button
                onClick={handlePlay}
                className="absolute inset-0 w-full h-full group cursor-pointer z-10"
                aria-label="Play apartment tour video"
              >
                <img
                  src={POSTER_URL}
                  alt="Apartment tour preview"
                  className="w-full h-full object-cover"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#d4bea0]/20 backdrop-blur-none border border-[#d4bea0]/30 flex items-center justify-center group-hover:bg-[#d4bea0]/30 transition-colors">
                    <Play className="w-7 h-7 md:w-8 md:h-8 text-[#f5f0eb] ml-1" fill="currentColor" />
                  </div>
                </div>
              </button>
            ) : null}
            <video
              ref={videoRef}
              src={VIDEO_URL}
              controls
              playsInline
              preload="none"
              poster={POSTER_URL}
              className={`w-full h-full object-cover ${!isPlaying ? "invisible" : ""}`}
            />
          </div>

          {/* Caption */}
          <p className="text-muted-foreground/60 text-[10px] md:text-xs tracking-[0.15em] uppercase mt-4 md:mt-6 font-light font-body text-center">
            Collectible Furniture · Artisan Craftsmanship · Bespoke Interiors
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default ApartmentTourInterlude;
