import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { fetchPublishedArticles, CATEGORY_LABELS, type JournalArticle, type JournalCategory } from "@/lib/journal";
import FeaturedReadBanner from "@/components/FeaturedReadBanner";

const ALL_CATEGORIES: JournalCategory[] = [
  "designer_interview",
  "collection_story",
  "design_trend",
  "project_showcase",
  "international_editorial",
];

const Journal = () => {
  const [articles, setArticles] = useState<JournalArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<JournalCategory | "all">("all");

  useEffect(() => {
    fetchPublishedArticles()
      .then(setArticles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeCategory === "all"
    ? articles
    : articles.filter((a) => a.category === activeCategory);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <>
      <Helmet>
        <title>Journal — Maison Affluency</title>
        <meta name="description" content="Design stories, designer interviews, and curatorial insights from Maison Affluency — Singapore's premier destination for collectible luxury furniture." />
        <link rel="canonical" href="https://maisonaffluency.com/journal" />
        <meta property="og:title" content="Journal — Maison Affluency" />
        <meta property="og:description" content="Design stories, designer interviews, and curatorial insights." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://maisonaffluency.com/journal" />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772516480/WhatsApp_Image_2026-03-03_at_1.40.10_PM_cs23b7.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Journal — Maison Affluency" />
        <meta name="twitter:description" content="Design stories, designer interviews, and curatorial insights." />
        <meta name="twitter:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772516480/WhatsApp_Image_2026-03-03_at_1.40.10_PM_cs23b7.jpg" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          "name": "Maison Affluency Journal",
          "url": "https://maisonaffluency.com/journal",
          "description": "Design stories, designer interviews, and curatorial insights from Singapore's premier collectible furniture destination.",
          "publisher": { "@type": "Organization", "name": "Maison Affluency", "url": "https://maisonaffluency.com" },
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Nav */}
        <div className="w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 md:px-12 py-3 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 font-body text-xs font-semibold text-foreground hover:text-primary transition-colors uppercase tracking-[0.1em]"
            >
              <ArrowLeft className="w-4 h-4" />
              Maison Affluency
            </Link>
            <span className="font-display text-sm tracking-widest text-muted-foreground">Journal</span>
          </div>
        </div>
        <FeaturedReadBanner />

        {/* Hero */}
        <div className="max-w-4xl mx-auto px-6 pt-14 pb-8 md:pt-20 md:pb-12 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="font-display text-3xl md:text-5xl text-foreground tracking-wide"
          >
            The Journal
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="font-body text-base md:text-lg text-muted-foreground mt-4 max-w-xl mx-auto"
          >
            Design stories, interviews, and curatorial insights from the world of collectible furniture.
          </motion.p>
        </div>

        {/* Category filter */}
        <div className="max-w-5xl mx-auto px-6 pb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-4 py-1.5 rounded-full font-body text-[11px] uppercase tracking-[0.15em] border transition-colors ${
                activeCategory === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
              }`}
            >
              All
            </button>
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full font-body text-[11px] uppercase tracking-[0.15em] border transition-colors ${
                  activeCategory === cat
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Articles */}
        <div className="max-w-6xl mx-auto px-6 pb-20">
          {loading ? (
            <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 animate-pulse">
                <div className="md:col-span-3">
                  <div className="aspect-[16/10] bg-muted rounded-sm mb-4" />
                  <div className="h-3 bg-muted rounded w-1/4 mb-3" />
                  <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-full" />
                </div>
                <div className="md:col-span-2 flex flex-col gap-6">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-28 h-20 bg-muted rounded-sm shrink-0" />
                      <div className="flex-1">
                        <div className="h-3 bg-muted rounded w-1/3 mb-2" />
                        <div className="h-4 bg-muted rounded w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-display text-xl text-foreground mb-2">Coming Soon</p>
              <p className="font-body text-sm text-muted-foreground">
                Our editorial team is crafting stories worth reading. Check back soon.
              </p>
            </div>
          ) : (
            <div className="space-y-16">
              {/* Hero — first article */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8">
                <motion.article
                  className="md:col-span-3"
                  initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link to={`/journal/${filtered[0].slug}`} className="group block">
                    {filtered[0].cover_image_url && (
                      <div className="aspect-[16/10] overflow-hidden rounded-sm mb-4">
                        <img
                          src={filtered[0].cover_image_url}
                          alt={filtered[0].title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-2">
                      {(filtered[0] as any).is_featured && (
                        <span className="font-body text-[9px] uppercase tracking-[0.18em] text-white bg-primary px-2 py-0.5 rounded-sm font-semibold">
                          Editor's Pick
                        </span>
                      )}
                      <span className="font-body text-[10px] uppercase tracking-[0.15em] text-primary">
                        {CATEGORY_LABELS[filtered[0].category]}
                      </span>
                      {filtered[0].read_time_minutes && (
                        <span className="font-body text-[10px] text-muted-foreground">
                          {filtered[0].read_time_minutes} min read
                        </span>
                      )}
                    </div>
                    <h2 className="font-display text-xl md:text-2xl text-foreground group-hover:text-primary transition-colors mb-2 leading-snug">
                      {filtered[0].title}
                    </h2>
                    <p className="font-body text-sm text-muted-foreground line-clamp-3 max-w-lg">
                      {filtered[0].excerpt}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="font-body text-[10px] text-muted-foreground">{filtered[0].author}</span>
                      <span className="text-border">·</span>
                      <span className="font-body text-[10px] text-muted-foreground">{formatDate(filtered[0].published_at)}</span>
                    </div>
                  </Link>
                </motion.article>

                {/* Side stack — articles 2 & 3 */}
                {filtered.length > 1 && (
                  <div className="md:col-span-2 flex flex-col gap-6">
                    {filtered.slice(1, 3).map((article, i) => (
                      <motion.article
                        key={article.id}
                        initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        transition={{ duration: 0.5, delay: 0.15 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <Link to={`/journal/${article.slug}`} className="group flex gap-4">
                          {article.cover_image_url && (
                            <div className="w-28 md:w-36 aspect-[4/3] overflow-hidden rounded-sm shrink-0">
                              <img
                                src={article.cover_image_url}
                                alt={article.title}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                loading="lazy"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {(article as any).is_featured && (
                                <span className="font-body text-[9px] uppercase tracking-[0.18em] text-white bg-primary px-1.5 py-0.5 rounded-sm font-semibold">
                                  Editor's Pick
                                </span>
                              )}
                              <span className="font-body text-[10px] uppercase tracking-[0.15em] text-primary">
                                {CATEGORY_LABELS[article.category]}
                              </span>
                            </div>
                            <h3 className="font-display text-sm md:text-base text-foreground group-hover:text-primary transition-colors mt-1 mb-1 leading-snug line-clamp-2">
                              {article.title}
                            </h3>
                            <p className="font-body text-xs text-muted-foreground line-clamp-2 hidden md:block">
                              {article.excerpt}
                            </p>
                            <span className="font-body text-[10px] text-muted-foreground mt-1.5 block">
                              {formatDate(article.published_at)}
                            </span>
                          </div>
                        </Link>
                      </motion.article>
                    ))}
                  </div>
                )}
              </div>

              {/* Remaining articles — standard grid */}
              {filtered.length > 3 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                  {filtered.slice(3).map((article, i) => (
                    <motion.article
                      key={article.id}
                      initial={{ opacity: 0, y: 24, filter: "blur(4px)" }}
                      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Link to={`/journal/${article.slug}`} className="group block">
                        {article.cover_image_url && (
                          <div className="aspect-[4/3] overflow-hidden rounded-sm mb-4">
                            <img
                              src={article.cover_image_url}
                              alt={article.title}
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-body text-[10px] uppercase tracking-[0.15em] text-primary">
                            {CATEGORY_LABELS[article.category]}
                          </span>
                          {article.read_time_minutes && (
                            <span className="font-body text-[10px] text-muted-foreground">
                              {article.read_time_minutes} min read
                            </span>
                          )}
                        </div>
                        <h2 className="font-display text-lg md:text-xl text-foreground group-hover:text-primary transition-colors mb-2 leading-snug">
                          {article.title}
                        </h2>
                        <p className="font-body text-sm text-muted-foreground line-clamp-2">
                          {article.excerpt}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="font-body text-[10px] text-muted-foreground">{article.author}</span>
                          <span className="text-border">·</span>
                          <span className="font-body text-[10px] text-muted-foreground">{formatDate(article.published_at)}</span>
                        </div>
                      </Link>
                    </motion.article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Journal;
