import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { fetchPublishedArticles, CATEGORY_LABELS, type JournalArticle } from "@/lib/journal";

const JournalTeaser = () => {
  const [articles, setArticles] = useState<JournalArticle[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchPublishedArticles(3)
      .then(setArticles)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Don't render if no published articles
  if (loaded && articles.length === 0) return null;

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <section className="py-16 md:py-24 px-6 md:px-12 lg:px-20 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7 }}
          className="flex items-end justify-between mb-10 md:mb-14"
        >
          <div>
            <h2 className="font-display text-2xl md:text-3xl text-foreground tracking-wide">
              From the Journal
            </h2>
            <p className="font-body text-sm text-muted-foreground mt-2">
              Design stories &amp; curatorial insights
            </p>
          </div>
          <Link
            to="/journal"
            className="hidden md:inline-flex items-center gap-2 font-body text-xs uppercase tracking-[0.15em] text-foreground hover:text-primary transition-colors group"
          >
            View all
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>

        {!loaded ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] bg-muted rounded-sm mb-4" />
                <div className="h-3 bg-muted rounded w-1/3 mb-3" />
                <div className="h-5 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-10">
            {articles.map((article, i) => (
              <motion.article
                key={article.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
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
                  <span className="font-body text-[10px] uppercase tracking-[0.15em] text-primary">
                    {CATEGORY_LABELS[article.category]}
                  </span>
                  <h3 className="font-display text-lg text-foreground group-hover:text-primary transition-colors mt-1 mb-1 leading-snug">
                    {article.title}
                  </h3>
                  <p className="font-body text-sm text-muted-foreground line-clamp-2">
                    {article.excerpt}
                  </p>
                  <span className="font-body text-[10px] text-muted-foreground mt-2 block">
                    {formatDate(article.published_at)}
                  </span>
                </Link>
              </motion.article>
            ))}
          </div>
        )}

        <div className="md:hidden text-center mt-10">
          <Link
            to="/journal"
            className="inline-flex items-center gap-2 px-6 py-2.5 border border-border rounded-full font-body text-xs uppercase tracking-[0.15em] text-foreground hover:bg-muted transition-colors"
          >
            View all articles
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default JournalTeaser;
