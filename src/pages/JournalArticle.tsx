import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { fetchArticleBySlug, CATEGORY_LABELS, type JournalArticle as Article } from "@/lib/journal";

const JournalArticlePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetchArticleBySlug(slug)
      .then(setArticle)
      .catch(() => navigate("/journal", { replace: true }))
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!article) return null;

  return (
    <>
      <Helmet>
        <title>{article.title} — Journal — Maison Affluency</title>
        <meta name="description" content={article.excerpt} />
        <link rel="canonical" href={`https://maisonaffluency.com/journal/${article.slug}`} />
        <meta property="og:title" content={`${article.title} — Maison Affluency`} />
        <meta property="og:description" content={article.excerpt} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://maisonaffluency.com/journal/${article.slug}`} />
        {article.cover_image_url && <meta property="og:image" content={article.cover_image_url} />}
        <meta property="article:published_time" content={article.published_at || ""} />
        <meta property="article:author" content={article.author} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": article.title,
          "description": article.excerpt,
          "image": article.cover_image_url,
          "author": { "@type": "Person", "name": article.author },
          "publisher": {
            "@type": "Organization",
            "name": "Maison Affluency",
            "url": "https://maisonaffluency.com",
            "logo": { "@type": "ImageObject", "url": "https://res.cloudinary.com/dif1oamtj/image/upload/v1772085523/affluency-logo-icon_mpchum.jpg" },
          },
          "datePublished": article.published_at,
          "dateModified": article.updated_at,
          "mainEntityOfPage": `https://maisonaffluency.com/journal/${article.slug}`,
          "articleSection": CATEGORY_LABELS[article.category],
          "keywords": article.tags?.join(", "),
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Nav */}
        <div className="w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 md:px-12 py-3 flex items-center justify-between">
            <Link
              to="/journal"
              className="inline-flex items-center gap-1.5 font-body text-xs font-semibold text-foreground hover:text-primary transition-colors uppercase tracking-[0.1em]"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Journal
            </Link>
          </div>
        </div>

        {/* Cover image */}
        {article.cover_image_url && (
          <div className="w-full max-h-[50vh] overflow-hidden">
            <img
              src={article.cover_image_url}
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Article header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto px-6 pt-10 md:pt-14"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="font-body text-[10px] uppercase tracking-[0.15em] text-primary">
              {CATEGORY_LABELS[article.category]}
            </span>
            {article.read_time_minutes && (
              <span className="font-body text-[10px] text-muted-foreground">
                {article.read_time_minutes} min read
              </span>
            )}
          </div>
          <h1 className="font-display text-2xl md:text-4xl lg:text-5xl text-foreground leading-tight mb-4">
            {article.title}
          </h1>
          <p className="font-body text-base md:text-lg text-muted-foreground mb-6">
            {article.excerpt}
          </p>
          <div className="flex items-center gap-3 pb-8 border-b border-border">
            <span className="font-body text-sm text-foreground">{article.author}</span>
            <span className="text-border">·</span>
            <span className="font-body text-sm text-muted-foreground">{formatDate(article.published_at)}</span>
          </div>
        </motion.div>

        {/* Article body */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-3xl mx-auto px-6 py-10 md:py-14"
        >
          <div
            className="prose prose-lg max-w-none font-body text-foreground/90
              prose-headings:font-display prose-headings:text-foreground prose-headings:tracking-wide
              prose-p:leading-relaxed prose-p:text-foreground/80
              prose-a:text-primary prose-a:underline prose-a:underline-offset-4
              prose-img:rounded-sm prose-img:my-8
              prose-blockquote:border-l-primary prose-blockquote:font-display prose-blockquote:italic prose-blockquote:text-foreground/70"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </motion.div>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="max-w-3xl mx-auto px-6 pb-14">
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 border border-border rounded-full font-body text-[10px] uppercase tracking-[0.1em] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="max-w-3xl mx-auto px-6 pb-20 text-center">
          <Link
            to="/journal"
            className="inline-flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All articles
          </Link>
        </div>
      </div>
    </>
  );
};

export default JournalArticlePage;
