import { useRef, useMemo } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/** Build a responsive srcSet from a Cloudinary URL that contains w_1600 */
function buildSrcSet(url: string): string {
  const widths = [640, 960, 1280, 1600];
  return widths
    .map(w => `${url.replace(/w_\d+/, `w_${w}`)} ${w}w`)
    .join(", ");
}

interface ParallaxInterludeProps {
  imageUrl: string;
  quote: string;
  attribution?: string;
  /** Overlay darkness 0–1, default 0.5 */
  overlayOpacity?: number;
  /** Reverse parallax direction */
  reverse?: boolean;
  /** CSS object-position for the image, default "center" */
  objectPosition?: string;
}

const ParallaxInterlude = ({
  imageUrl,
  quote,
  attribution,
  overlayOpacity = 0.5,
  reverse = false,
  objectPosition = "center",
}: ParallaxInterludeProps) => {
  const srcSet = useMemo(() => imageUrl.includes("w_") ? buildSrcSet(imageUrl) : undefined, [imageUrl]);
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Image moves opposite to scroll for depth
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reverse ? ["10%", "-10%"] : ["-10%", "10%"]
  );

  // Text fades in as section enters viewport center
  const textOpacity = useTransform(scrollYProgress, [0.15, 0.35, 0.65, 0.85], [0, 1, 1, 0]);
  const textY = useTransform(scrollYProgress, [0.15, 0.35, 0.65, 0.85], [40, 0, 0, -40]);

  // Subtle horizontal line animation
  const lineScale = useTransform(scrollYProgress, [0.2, 0.45], [0, 1]);

  return (
    <div
      ref={ref}
      className="relative w-full h-[50vh] md:h-[70vh] overflow-hidden"
      aria-hidden="true"
    >
      {/* Parallax background image */}
      <motion.div
        className="absolute inset-0 w-full h-[120%] -top-[10%]"
        style={{ y }}
      >
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          sizes="100vw"
          className="w-full h-full object-cover"
          style={{ objectPosition }}
        />
      </motion.div>

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,${overlayOpacity * 0.8}) 0%, rgba(0,0,0,${overlayOpacity}) 50%, rgba(0,0,0,${overlayOpacity * 0.8}) 100%)`,
        }}
      />

      {/* Text content */}
      <motion.div
        className="relative z-10 h-full flex flex-col items-center justify-center px-6 md:px-16 lg:px-24 text-center"
        style={{ opacity: textOpacity, y: textY }}
      >
        {/* Decorative line above */}
        <motion.div
          className="w-12 h-px bg-[hsl(var(--gold))] mb-6 md:mb-8 origin-center"
          style={{ scaleX: lineScale }}
        />

        <blockquote className="max-w-3xl">
          <p className="font-display text-lg md:text-2xl lg:text-3xl text-white/95 leading-relaxed md:leading-relaxed tracking-wide italic">
            "{quote}"
          </p>
        </blockquote>

        {attribution && (
          <p className="mt-4 md:mt-6 font-body text-xs md:text-sm uppercase tracking-[0.2em] text-[hsl(var(--gold))]">
            {attribution}
          </p>
        )}

        {/* Decorative line below */}
        <motion.div
          className="w-12 h-px bg-[hsl(var(--gold))] mt-6 md:mt-8 origin-center"
          style={{ scaleX: lineScale }}
        />
      </motion.div>
    </div>
  );
};

export default ParallaxInterlude;
