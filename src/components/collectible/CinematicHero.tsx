import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Share2, Check } from "lucide-react";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import { cn } from "@/lib/utils";

interface CinematicHeroProps {
  name: string;
  specialty?: string | null;
  heroImage: string;
  photoCredit?: string | null;
  shareCopied?: boolean;
  onShare?: (e: React.MouseEvent) => void;
  onScrollToArchive?: () => void;
  className?: string;
}

export function CinematicHero({
  name,
  specialty,
  heroImage,
  photoCredit,
  shareCopied,
  onShare,
  onScrollToArchive,
  className,
}: CinematicHeroProps) {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // Background parallax at different speeds for layered depth
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "28%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.05, 1.18]);
  const overlay1Y = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const overlay2Y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "-15%"]);

  const optimizedImage = optimizeImageUrl(heroImage, "w_1920,c_fill,q_auto:good,f_auto,dpr_auto");

  return (
    <section
      ref={containerRef}
      className={cn(
        "relative h-screen w-full overflow-hidden bg-[hsl(var(--cinematic-hero-bg))]",
        className
      )}
    >
      {/* Full-bleed background image layer — slow parallax + Ken Burns zoom */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{ y: bgY, scale: bgScale }}
        initial={{ scale: 1 }}
      >
        <img
          src={optimizedImage}
          alt={name}
          className="h-full w-full object-cover opacity-60 animate-ken-burns"
          loading="eager"
          decoding="async"
        />
      </motion.div>

      {/* Top gradient overlay for navigation readability */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-[hsl(var(--cinematic-hero-bg))/80] via-transparent to-transparent" />

      {/* Bottom gradient overlay — slower parallax */}
      <motion.div
        className="absolute inset-0 z-[1] bg-gradient-to-t from-[hsl(var(--cinematic-hero-bg))] via-transparent to-black/30"
        style={{ y: overlay1Y }}
      />

      {/* Side vignette overlay — medium parallax */}
      <motion.div
        className="absolute inset-0 z-[1] bg-gradient-to-r from-[hsl(var(--cinematic-hero-bg))/40] via-transparent to-[hsl(var(--cinematic-hero-bg))/40]"
        style={{ y: overlay2Y }}
      />

      {/* Main artist identity — fades and lifts on scroll */}
      <motion.div
        className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center"
        style={{ opacity: contentOpacity, y: contentY }}
      >
        <div className="max-w-5xl">
          {/* Top accent line */}
          <div className="mb-8 flex items-center justify-center space-x-6 md:mb-10">
            <div className="h-px w-16 bg-[hsl(var(--cinematic-hero-accent))/60]" />
            <span className="font-body text-[10px] font-medium uppercase tracking-[0.6em] text-[hsl(var(--cinematic-hero-accent))]">
              Collectible Design
            </span>
            <div className="h-px w-16 bg-[hsl(var(--cinematic-hero-accent))/60]" />
          </div>

          {/* Dramatic typography */}
          <h1 className="font-serif text-[14vw] leading-[0.85] tracking-tighter text-[hsl(var(--cinematic-hero-text))] italic md:text-[10vw]">
            {name.split(" ").length > 1 ? (
              <>
                {name.split(" ").slice(0, -1).join(" ")}{" "}
                <span className="not-italic font-semibold md:inline">
                  {name.split(" ").slice(-1)[0]}
                </span>
              </>
            ) : (
              <span className="not-italic font-semibold">{name}</span>
            )}
          </h1>

          {/* Specialty tagline */}
          {specialty && (
            <div className="mt-8 flex flex-col items-center md:mt-10">
              <p className="max-w-lg font-body text-xs font-light uppercase tracking-[0.4em] text-[hsl(var(--cinematic-hero-text-muted))]">
                {specialty}
              </p>
              <div className="mt-6 h-px w-24 bg-[hsl(var(--cinematic-hero-accent))/30]" />
            </div>
          )}
        </div>
      </motion.div>

      {/* Right-side rail: Browse the archive */}
      <motion.div
        className="absolute right-6 top-1/2 z-20 hidden -translate-y-1/2 lg:right-10 lg:block"
        style={{ opacity: contentOpacity }}
      >
        <button
          type="button"
          onClick={onScrollToArchive}
          className="group flex flex-col items-center gap-3 text-[hsl(var(--cinematic-hero-text-muted))] transition-colors hover:text-[hsl(var(--cinematic-hero-text))]"
          aria-label="Browse the archive"
        >
          <span className="font-body text-[10px] uppercase tracking-[0.35em]">
            Browse the archive
          </span>
          <div className="h-16 w-px bg-[hsl(var(--cinematic-hero-text-muted))] transition-colors group-hover:bg-[hsl(var(--cinematic-hero-text))]" />
        </button>
      </motion.div>

      {/* Scroll engagement cue */}
      <motion.div
        className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center space-y-4"
        style={{ opacity: contentOpacity }}
      >
        <button
          type="button"
          onClick={onScrollToArchive}
          className="group flex flex-col items-center gap-3"
          aria-label="Scroll to view the archive"
        >
          <span className="font-body text-[9px] uppercase tracking-[0.5em] text-[hsl(var(--cinematic-hero-text-muted))]">
            View the archive
          </span>
          <div className="relative h-24 w-px overflow-hidden bg-gradient-to-b from-[hsl(var(--cinematic-hero-accent))] to-transparent">
            <div className="absolute top-0 left-0 h-1/2 w-full animate-scroll-cue bg-[hsl(var(--cinematic-hero-text))]" />
          </div>
        </button>
      </motion.div>

      {/* Top-right share badge */}
      {onShare && (
        <motion.div
          className="absolute top-24 right-8 z-20 md:top-28 md:right-12"
          style={{ opacity: contentOpacity }}
        >
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 border border-[hsl(var(--cinematic-hero-accent))/20] bg-[hsl(var(--cinematic-hero-bg))/20] px-4 py-2 backdrop-blur-md transition-colors hover:border-[hsl(var(--cinematic-hero-accent))/40]"
          >
            {shareCopied ? (
              <Check className="h-3.5 w-3.5 text-[hsl(var(--cinematic-hero-accent))]" />
            ) : (
              <Share2 className="h-3.5 w-3.5 text-[hsl(var(--cinematic-hero-accent))]" />
            )}
            <span className="font-body text-[9px] uppercase tracking-[0.3em] text-[hsl(var(--cinematic-hero-accent))]">
              {shareCopied ? "Copied" : "Share"}
            </span>
          </button>
        </motion.div>
      )}

      {/* Corner framing */}
      <div className="pointer-events-none absolute top-6 left-6 z-20 h-24 w-24 border-l border-t border-[hsl(var(--cinematic-hero-accent))/10] md:top-8 md:left-8 md:h-32 md:w-32" />
      <div className="pointer-events-none absolute bottom-6 right-6 z-20 h-24 w-24 border-r border-b border-[hsl(var(--cinematic-hero-accent))/10] md:bottom-8 md:right-8 md:h-32 md:w-32" />

      {/* Photo credit */}
      {photoCredit && (
        <p className="absolute bottom-2 right-4 z-20 text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--cinematic-hero-text-muted))]">
          Photo: {photoCredit}
        </p>
      )}
    </section>
  );
}
