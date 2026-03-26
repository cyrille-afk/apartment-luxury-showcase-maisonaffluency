import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Share2, Play, Check, Copy } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { scrollToSection } from "@/lib/scrollToSection";

const VIDEO_URL = "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/videos/apartment-tour-voiceover.mp4";
const POSTER_URL = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1600,q_auto:good,c_fill,g_auto/bespoke-sofa_gxidtx";

const ApartmentTourInterlude = ({ compact = false }: { compact?: boolean }) => {
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
    const shareUrl = `${window.location.origin}/apartment-tour-share-v6.html`;
    const text = `${shareUrl}`;

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

  if (compact) {
    return (
      <section ref={ref} id="apartment-tour" className="pt-4 md:pt-8 pb-2 md:pb-4 bg-white scroll-mt-32">
        <div className="mx-auto max-w-6xl px-4 md:px-12 lg:px-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="flex flex-col md:flex-row gap-4 md:gap-8 items-start"
          >
            {/* Text — compact, left side */}
            <div className="flex-1 flex flex-col justify-center order-2 md:order-1">
              <p className="text-[10px] md:text-[11px] tracking-[0.3em] uppercase text-muted-foreground/60 mb-2 font-light font-body">
                Maison Affluency · Singapore
              </p>
              <h2 className="font-serif text-lg md:text-2xl text-foreground font-light tracking-wide">
                Tour Our Gallery
              </h2>
              <h3 className="font-serif text-base md:text-lg text-muted-foreground font-light tracking-wide mt-0.5">
                & Meet the Curating Team
              </h3>
               <p className="text-muted-foreground text-xs tracking-[0.08em] mt-2 font-light font-body max-w-md">
                An exclusive cinematic tour of a bespoke Singapore apartment — collectible furniture, artisan craftsmanship, and panoramic cityscape views.
              </p>

              {/* The Curating Team — inline */}
              <p className="text-[10px] md:text-[11px] tracking-[0.25em] uppercase text-muted-foreground/50 mt-5 mb-2 font-light font-body">
                The Curating Team
              </p>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center text-center">
                  <img
                    src="https://res.cloudinary.com/dif1oamtj/image/upload/w_128,q_auto,c_fill/IMG_2542_1_kc4fvs"
                    alt="Cyrille Delval"
                    className="w-12 h-12 rounded-full object-cover border-2 border-[hsl(var(--gold))] shadow-sm"
                  />
                  <span className="text-[10px] font-body text-foreground mt-1 tracking-wide">Cyrille Delval</span>
                  <span className="text-[9px] font-body text-muted-foreground/70 tracking-wider uppercase">Founder & Curator</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <img
                    src="https://res.cloudinary.com/dif1oamtj/image/upload/w_128,q_auto,c_fill/Screen_Shot_2026-02-26_at_9.59.00_PM_wivwhs"
                    alt="Elsa Lemarignier"
                    className="w-12 h-12 rounded-full object-cover border-2 border-[hsl(var(--gold))] shadow-sm"
                  />
                  <span className="text-[10px] font-body text-foreground mt-1 tracking-wide">Elsa Lemarignier</span>
                  <span className="text-[9px] font-body text-muted-foreground/70 tracking-wider uppercase">Art Director</span>
                </div>
              </div>
            </div>

            {/* Video — compact, right side */}
            <div className="relative w-full md:w-1/2 order-1 md:order-2">
              <div className="overflow-hidden rounded-sm shadow-lg" style={{ aspectRatio: "16/9" }}>
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#d4bea0]/20 backdrop-blur-none border border-[#d4bea0]/30 flex items-center justify-center group-hover:bg-[#d4bea0]/30 transition-colors">
                        <Play className="w-5 h-5 md:w-6 md:h-6 text-[#f5f0eb] ml-0.5" fill="currentColor" />
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
              <div className="flex justify-end mt-1.5">
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 text-[11px] font-body text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Share apartment tour"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    );
  }

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
