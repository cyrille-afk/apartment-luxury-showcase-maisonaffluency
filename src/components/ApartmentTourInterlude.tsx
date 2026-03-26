import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Share2, Play, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { scrollToSection } from "@/lib/scrollToSection";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

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
              <h2 className="font-serif text-base md:text-lg text-foreground font-light tracking-wide">
                Tour Our Gallery
              </h2>
               <p className="text-xs md:text-sm font-body text-muted-foreground/60 italic tracking-wide mt-0.5">
                An exclusive cinematic tour of a bespoke Singapore apartment — collectible furniture, artisan craftsmanship, and panoramic cityscape views.
              </p>

              {/* The Curating Team — inline */}
              <h3 className="font-serif text-base md:text-lg text-foreground font-light tracking-wide mt-4">
                & Meet the Curating Team
              </h3>
              <div className="flex items-center gap-6 mt-0.5 mb-3">
                <p className="text-xs md:text-sm font-body text-muted-foreground/60 italic tracking-wide">
                  The heart and soul of the gallery and designers selection
                </p>
                <div className="flex items-start gap-8">
                {[
                  {
                    name: "Cyrille Delval",
                    role: "Co-Founder & CEO",
                    image: "https://res.cloudinary.com/dif1oamtj/image/upload/w_128,q_auto,c_fill/IMG_2542_1_kc4fvs",
                    bio: "During a 4 year span, Cyrille studied Art History at the renown Birkbeck College in London whilst navigating a successful investment banking career in London and New York at the same time. This lead him to a serial entrepreneurship life where business and passion mingle. As Affluency co-founder, Cyrille leads Maison Affluency's development in Southeast Asia and the Middle East, sharing his passion for exceptional craftsmanship and unique design pieces.",
                  },
                  {
                    name: "Elsa Lemarignier",
                    role: "Co-Founder & CPO",
                    image: "https://res.cloudinary.com/dif1oamtj/image/upload/w_128,q_auto,c_fill/Screen_Shot_2026-02-26_at_9.59.00_PM_wivwhs",
                    bio: "After attending the Ecole du Louvre, Elsa opened her gallery in Paris Carré Rive Gauche where she curated a unique design collection with prominent designers such as Ron Arad. As Affluency co-founder, her mission is to seek out and select exceptional design, art and collectible pieces around the world, showcasing exceptional craftsmanship.",
                  },
                ].map((member) => (
                  <Dialog key={member.name}>
                    <DialogTrigger asChild>
                      <button className="flex flex-col items-center text-center group cursor-pointer">
                        <div className="relative">
                          <img
                            src={member.image}
                            alt={member.name}
                            className="w-20 h-20 rounded-full object-cover border-2 border-[hsl(var(--gold))] shadow-sm group-hover:scale-110 transition-transform duration-300"
                          />
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background border border-[hsl(var(--gold))]/40 flex items-center justify-center">
                            <Search className="w-2.5 h-2.5 text-muted-foreground" />
                          </div>
                        </div>
                        <span className="text-[10px] font-body text-foreground mt-1 tracking-wide group-hover:text-primary transition-colors">{member.name}</span>
                        <span className="text-[9px] font-body text-muted-foreground/70 tracking-wider uppercase">{member.role}</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-primary/20 [&>button]:absolute [&>button]:top-3 [&>button]:right-3 [&>button]:z-50 [&>button]:bg-background/80 [&>button]:backdrop-blur-sm [&>button]:rounded-full [&>button]:w-9 [&>button]:h-9 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:shadow-md [&>button]:border [&>button]:border-primary/20 [&>button]:text-foreground">
                      <div className="flex flex-col items-center p-6 pt-10">
                        <img
                          src={member.image}
                          alt={member.name}
                          className="w-24 h-24 rounded-full object-cover border-2 border-[hsl(var(--gold))] shadow-lg mb-4"
                        />
                        <h3 className="font-display text-lg text-primary font-semibold">{member.name}</h3>
                        <p className="text-xs text-muted-foreground tracking-[0.15em] uppercase font-body mb-4">{member.role}</p>
                        <p className="text-sm text-muted-foreground font-body text-justify max-w-sm">{member.bio}</p>
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
                </div>
              </div>
            </div>

            {/* Video — compact, right side */}
            <div className="flex items-start gap-5 w-full md:w-[55%] order-1 md:order-2">
              <div className="relative flex-1 overflow-hidden rounded-sm shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35)]" style={{ aspectRatio: "16/9" }}>
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
              <button
                onClick={handleShare}
                className="flex flex-col items-center gap-1 text-xs font-body text-muted-foreground hover:text-primary transition-colors mt-1"
                aria-label="Share apartment tour"
              >
                <Share2 className="w-5 h-5" />
                <span>Share</span>
              </button>
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
