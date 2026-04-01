import { memo } from "react";
import { Instagram } from "lucide-react";
import { motion } from "framer-motion";
import type { DesignerInstagramPost } from "@/hooks/useDesignerInstagramPosts";

interface Props {
  posts: DesignerInstagramPost[];
  designerName: string;
}

const DesignerInstagramSection = memo(({ posts, designerName }: Props) => {
  // Only show posts that have an image_url
  const postsWithImages = posts.filter((p) => p.image_url);
  if (!postsWithImages.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mt-20 md:mt-28 pt-12 md:pt-16 border-t border-border/40"
    >
      {/* Section header */}
      <div className="flex items-center justify-center gap-3 mb-8 md:mb-10">
        <div className="h-px flex-1 bg-foreground/20" />
        <div className="flex items-center gap-2 shrink-0">
          <Instagram className="w-4 h-4 text-foreground" />
          <h2 className="font-display text-[11px] md:text-xs tracking-[0.2em] uppercase text-foreground font-semibold">
            From the Studio
          </h2>
        </div>
        <div className="h-px flex-1 bg-foreground/20" />
      </div>

      {/* Horizontal Instagram-style strip — single row, equal height, natural widths */}
      <div className="flex gap-1 w-full overflow-x-auto scrollbar-hide">
        {postsWithImages.map((post) => (
          <a
            key={post.id}
            href={post.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative shrink-0 h-[280px] md:h-[320px] overflow-hidden bg-muted"
            style={{ flex: `1 1 0%`, minWidth: 0 }}
          >
            <img
              src={post.image_url!}
              alt={post.caption || `${designerName} — Instagram`}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              loading="lazy"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors duration-300 flex items-end justify-start p-3">
              <div className="translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <Instagram className="w-4 h-4 text-background" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </motion.section>
  );
});

DesignerInstagramSection.displayName = "DesignerInstagramSection";

export default DesignerInstagramSection;
