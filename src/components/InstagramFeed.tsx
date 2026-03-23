import { Instagram } from "lucide-react";

/**
 * Manually curated Instagram feed grid.
 * Update the POSTS array to refresh content — no API needed.
 */

interface InstaPost {
  /** Cloudinary or direct image URL */
  imageUrl: string;
  /** Instagram post permalink */
  postUrl: string;
  /** Alt text */
  alt: string;
}

const POSTS: InstaPost[] = [
  {
    imageUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_600,h_600,c_fill,q_auto,f_auto/v1773373912/Screen_Shot_2026-03-13_at_11.51.17_AM_egvsuz.png",
    postUrl: "https://www.instagram.com/myaffluency/",
    alt: "Curated showroom vignette at Maison Affluency Singapore",
  },
  {
    imageUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_600,h_600,c_fill,q_auto,f_auto/v1773372909/Screen_Shot_2026-03-13_at_11.34.42_AM_icbzuz.png",
    postUrl: "https://www.instagram.com/myaffluency/",
    alt: "Collectible design piece in situ",
  },
  {
    imageUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_600,h_600,c_fill,q_auto,f_auto/v1773374192/Screen_Shot_2026-03-13_at_11.55.51_AM_vbstnu.png",
    postUrl: "https://www.instagram.com/myaffluency/",
    alt: "Atelier craftsmanship detail",
  },
  {
    imageUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_600,h_600,c_fill,q_auto,f_auto/v1772516480/WhatsApp_Image_2026-03-03_at_1.40.10_PM_cs23b7.jpg",
    postUrl: "https://www.instagram.com/myaffluency/",
    alt: "Private viewing at Maison Affluency",
  },
  {
    imageUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_600,h_600,c_fill,g_center,q_auto,f_auto/v1773373912/Screen_Shot_2026-03-13_at_11.51.17_AM_egvsuz.png",
    postUrl: "https://www.instagram.com/myaffluency/",
    alt: "Designer furniture close-up",
  },
  {
    imageUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_600,h_600,c_fill,g_north,q_auto,f_auto/v1773374192/Screen_Shot_2026-03-13_at_11.55.51_AM_vbstnu.png",
    postUrl: "https://www.instagram.com/myaffluency/",
    alt: "Material detail from European atelier",
  },
];

const InstagramFeed = () => {
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
          {POSTS.map((post, i) => (
            <a
              key={i}
              href={post.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden bg-muted"
            >
              <img
                src={post.imageUrl}
                alt={post.alt}
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
