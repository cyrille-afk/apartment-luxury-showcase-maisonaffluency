import { useEffect, useRef, memo } from "react";
import { Instagram } from "lucide-react";
import { motion } from "framer-motion";
import type { DesignerInstagramPost } from "@/hooks/useDesignerInstagramPosts";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

let scriptLoaded = false;

function loadInstagramScript() {
  if (scriptLoaded) return;
  scriptLoaded = true;
  const s = document.createElement("script");
  s.src = "https://www.instagram.com/embed.js";
  s.async = true;
  document.body.appendChild(s);
}

function InstagramEmbed({ postUrl }: { postUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInstagramScript();
    // Re-process embeds when the component mounts
    const timer = setTimeout(() => {
      window.instgrm?.Embeds.process();
    }, 300);
    return () => clearTimeout(timer);
  }, [postUrl]);

  // Extract clean URL (strip query params like ?hl=en)
  const cleanUrl = postUrl.split("?")[0].replace(/\/$/, "") + "/";

  return (
    <div ref={ref} className="instagram-embed-container w-full max-w-[328px] mx-auto">
      <blockquote
        className="instagram-media"
        data-instgrm-captioned
        data-instgrm-permalink={cleanUrl}
        data-instgrm-version="14"
        style={{
          background: "transparent",
          border: 0,
          margin: "0 auto",
          maxWidth: "328px",
          minWidth: "280px",
          padding: 0,
          width: "100%",
        }}
      />
    </div>
  );
}

interface Props {
  posts: DesignerInstagramPost[];
  designerName: string;
}

const DesignerInstagramSection = memo(({ posts, designerName }: Props) => {
  if (!posts.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mt-16 md:mt-20"
    >
      {/* Section header */}
      <div className="flex items-center justify-center gap-3 mb-8 md:mb-10">
        <div className="h-px flex-1 bg-border/40" />
        <div className="flex items-center gap-2 shrink-0">
          <Instagram className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-display text-[11px] md:text-xs tracking-[0.2em] uppercase text-muted-foreground">
            From the Studio
          </h2>
        </div>
        <div className="h-px flex-1 bg-border/40" />
      </div>

      {/* Embed grid */}
      <div
        className={`grid gap-6 justify-items-center ${
          posts.length === 1
            ? "grid-cols-1 max-w-sm mx-auto"
            : posts.length === 2
            ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto"
        }`}
      >
        {posts.map((post) => (
          <div key={post.id} className="w-full flex flex-col items-center">
            <InstagramEmbed postUrl={post.post_url} />
            {post.caption && (
              <p className="font-body text-[10px] text-muted-foreground/70 text-center mt-2 max-w-[300px] italic">
                {post.caption}
              </p>
            )}
          </div>
        ))}
      </div>
    </motion.section>
  );
});

DesignerInstagramSection.displayName = "DesignerInstagramSection";

export default DesignerInstagramSection;
