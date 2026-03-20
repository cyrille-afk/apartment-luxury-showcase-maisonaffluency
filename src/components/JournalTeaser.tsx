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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="md:col-span-3 animate-pulse">
              <div className="aspect-[16/10] bg-muted rounded-sm mb-4" />
              <div className="h-3 bg-muted rounded w-1/4 mb-3" />
              <div className="h-6 bg-muted rounded w-3/4 mb-2" />
              <div className="h-4 bg-muted rounded w-full" />
            </div>
            <div className="md:col-span-2 flex flex-col gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse flex gap-4">
                  <div className="w-28 h-20 bg-muted rounded-sm shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 bg-muted rounded w-1/3 mb-2" />
                    <div className="h-4 bg-muted rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8">
            {/* Hero — latest article */}
            {articles[0] && (
              <motion.article
                className="md:col-span-3"
                initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link to={`/journal/${articles[0].slug}`} className="group block">
                  {articles[0].cover_image_url && (
                    <div className="aspect-[16/10] overflow-hidden rounded-sm mb-4">
                      <img
                        src={articles[0].cover_image_url}
                        alt={articles[0].title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {(articles[0] as any).is_featured && (
                      <span className="font-body text-[9px] uppercase tracking-[0.18em] text-white bg-primary px-2 py-0.5 rounded-sm font-semibold">
                        Editor's Pick
                      </span>
                    )}
                    <span className="font-body text-[10px] uppercase tracking-[0.15em] text-primary">
                      {CATEGORY_LABELS[articles[0].category]}
                    </span>
                  </div>
                  <h3 className="font-display text-xl md:text-2xl text-foreground group-hover:text-primary transition-colors mt-1.5 mb-1.5 leading-snug">
                    {articles[0].title}
                  </h3>
                  <p className="font-body text-sm text-muted-foreground line-clamp-2 max-w-lg">
                    {articles[0].excerpt}
                  </p>
                  <span className="font-body text-[10px] text-muted-foreground mt-2 block">
                    {formatDate(articles[0].published_at)}
                  </span>
                </Link>
              </motion.article>
            )}

            {/* Side stack — next 2 articles */}
            {articles.length > 1 && (
              <div className="md:col-span-2 flex flex-col gap-6 md:justify-start">
                {articles.slice(1, 3).map((article, i) => (
                  <motion.article
                    key={article.id}
                    initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                    whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    viewport={{ once: true, amount: 0.2 }}
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
