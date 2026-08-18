import { memo, useState } from "react";
import { Instagram, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import type { DesignerInstagramPost } from "@/hooks/useDesignerInstagramPosts";

interface Props {
  posts: DesignerInstagramPost[];
  designerName: string;
  /** Nested inside an editorial column (New In format): tighter type, no outer padding/border */
  compact?: boolean;
}

const InstagramTile = ({
  post,
  designerName,
  hiddenOnMobile,
}: {
  post: DesignerInstagramPost;
  designerName: string;
  hiddenOnMobile: boolean;
}) => {
  const [failed, setFailed] = useState(false);
  const baseCls = `group relative block aspect-square overflow-hidden bg-muted ${hiddenOnMobile ? "hidden md:block" : ""}`;

  return (
    <a href={post.post_url} target="_blank" rel="noopener noreferrer" className={baseCls}>
      {!failed && post.image_url ? (
        <>
          <img
            src={post.image_url}
            alt={post.caption || `${designerName} — Instagram`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
            onError={() => setFailed(true)}
          />
          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors duration-300 flex items-center justify-center">
            <Instagram className="h-5 w-5 text-background opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted text-center px-3 transition-colors group-hover:bg-foreground/5">
          <Instagram className="h-5 w-5 text-foreground/70" />
          <span className="font-display text-[10px] tracking-[0.15em] uppercase text-foreground/80 inline-flex items-center gap-1">
            View post <ExternalLink className="h-3 w-3" />
          </span>
        </div>
      )}
    </a>
  );
};

const DesignerInstagramSection = memo(({ posts, designerName, compact }: Props) => {
  // Only show posts that have an image_url
  const postsWithImages = posts.filter((p) => p.image_url);
  if (!postsWithImages.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={compact ? "" : "mt-12 md:mt-16 pt-12 md:pt-16 border-t border-border/40"}
    >
      {/* Section header */}
      <div className={compact ? "flex items-center gap-3 mb-4" : "flex items-center justify-center gap-3 mb-8 md:mb-10 px-4 md:px-12"}>
        <div className={compact ? "h-px flex-1 bg-foreground/35" : "h-px flex-1 bg-foreground/35"} />
        <div className="flex items-center gap-2 shrink-0">
          <Instagram className={compact ? "w-3.5 h-3.5 text-foreground/70" : "w-4 h-4 text-foreground"} />
          <h2 className={compact ? "font-display text-[10px] md:text-[11px] tracking-[0.2em] uppercase text-foreground/70 font-semibold" : "font-display text-[11px] md:text-xs tracking-[0.2em] uppercase text-foreground font-semibold"}>
            From the Studio
          </h2>
        </div>
        <div className={compact ? "h-px flex-1 bg-foreground/35" : "h-px flex-1 bg-foreground/35"} />
      </div>

      {/* Grid — matches homepage Instagram feed layout */}
      <div className={compact ? "grid grid-cols-3 md:grid-cols-5 gap-1 md:gap-1.5" : "grid grid-cols-3 md:grid-cols-5 gap-1 md:gap-1.5 px-4 md:px-12 lg:px-20"}>
          {postsWithImages.slice(0, 6).map((post, index) => (
            <InstagramTile
              key={post.id}
              post={post}
              designerName={designerName}
              hiddenOnMobile={index >= 3}
            />
          ))}
      </div>
    </motion.section>
  );
});

DesignerInstagramSection.displayName = "DesignerInstagramSection";

export default DesignerInstagramSection;
