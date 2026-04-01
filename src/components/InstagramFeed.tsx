import { Instagram } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const InstagramFeed = () => {
  const { data: posts = [] } = useQuery({
    queryKey: ["homepage-instagram-feed"],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      // Maison Affluency brand designer ID for @myaffluency homepage feed
      const BRAND_DESIGNER_ID = "fc97c782-b149-482e-b362-a9427088d211";
      const { data, error } = await supabase
        .from("designer_instagram_posts")
        .select("*")
        .eq("designer_id", BRAND_DESIGNER_ID)
        .not("image_url", "is", null)
        .order("sort_order", { ascending: true })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
  });

  if (posts.length === 0) return null;

  return (
    <section className="bg-background border-t border-border px-6 py-14 md:px-12 lg:px-20">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Instagram className="h-5 w-5 text-foreground" />
          <a
            href="https://www.instagram.com/myaffluency/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-sm uppercase tracking-[0.2em] text-foreground hover:text-primary transition-colors"
          >
            @myaffluency
          </a>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-1 md:gap-1.5">
          {posts.map((post) => (
            <a
              key={post.id}
              href={post.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden bg-muted"
            >
              <img
                src={post.image_url!}
                alt={post.caption?.substring(0, 80) || "Instagram post"}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors duration-300 flex items-center justify-center">
                <Instagram className="h-5 w-5 text-background opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </a>
          ))}
        </div>

        <p className="text-center mt-6">
          <a
            href="https://www.instagram.com/myaffluency/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Follow us on Instagram →
          </a>
        </p>
      </div>
    </section>
  );
};

export default InstagramFeed;
