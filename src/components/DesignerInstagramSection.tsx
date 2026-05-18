import { memo, useState } from "react";
import { Instagram, ExternalLink } from "lucide-react";
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
      className="mt-12 md:mt-16 pt-12 md:pt-16 border-t border-border/40"
    >
      {/* Section header */}
      <div className="flex items-center justify-center gap-3 mb-8 md:mb-10 px-4 md:px-12">
        <div className="h-px flex-1 bg-foreground/20" />
        <div className="flex items-center gap-2 shrink-0">
          <Instagram className="w-4 h-4 text-foreground" />
          <h2 className="font-display text-[11px] md:text-xs tracking-[0.2em] uppercase text-foreground font-semibold">
            From the Studio
          </h2>
        </div>
        <div className="h-px flex-1 bg-foreground/20" />
      </div>

      {/* Grid — matches homepage Instagram feed layout */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-1 md:gap-1.5 px-4 md:px-12 lg:px-20">
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
