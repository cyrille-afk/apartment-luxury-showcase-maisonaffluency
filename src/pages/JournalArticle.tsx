import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, X } from "lucide-react";
import { sharePageOnWhatsApp } from "@/lib/whatsapp-share";
import { trackCTA } from "@/lib/analytics";
import WhatsAppShareButton from "@/components/WhatsAppShareButton";
import { motion, AnimatePresence } from "framer-motion";
import { fetchArticleBySlug, CATEGORY_LABELS, type JournalArticle as Article } from "@/lib/journal";

const PdfViewer = lazy(() => import("@/components/journal/PdfViewer"));

const JournalArticlePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetchArticleBySlug(slug)
      .then(setArticle)
      .catch(() => navigate("/journal", { replace: true }))
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  const hasGallery = article?.gallery_images && article.gallery_images.length > 0;

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
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://maisonaffluency.com" },
            { "@type": "ListItem", "position": 2, "name": "Journal", "item": "https://maisonaffluency.com/journal" },
            { "@type": "ListItem", "position": 3, "name": article.title, "item": `https://maisonaffluency.com/journal/${article.slug}` },
          ],
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
            <WhatsAppShareButton
              onClick={() => {
                sharePageOnWhatsApp(`/journal/${slug}`, article.title, article.excerpt?.slice(0, 60));
                trackCTA.whatsapp(`JournalArticle_Share_${article.slug}`);
              }}
              label="Share on WhatsApp"
              variant="prominent"
              className="md:!text-sm md:!px-4 md:!py-2"
            />
          </div>
        </div>

        {/* Cover image */}
        {article.cover_image_url && (
          <div className="w-full flex flex-col items-center bg-muted/10">
            <img
              src={article.cover_image_url}
              alt={article.title}
              className="w-full max-h-[80vh] object-contain"
            />
            {article.slug === "thierry-lemaire-radical-simplicity" && (
            <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground py-3">
                Photography by Hosanna Swee · Shot on location at Maison Affluency, Singapore
              </p>
            )}
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

        {/* Photo gallery (if gallery_images present) */}
        {hasGallery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-14"
          >
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 md:gap-4">
              {article.gallery_images.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className="relative block w-full mb-3 md:mb-4 break-inside-avoid group cursor-pointer"
                >
                  <img
                    src={url}
                    alt={`${article.title} — Photo ${i + 1}`}
                    className="w-full rounded-sm object-cover transition-all duration-300 group-hover:shadow-lg group-hover:brightness-95"
                    loading="lazy"
                  />
                  <span className="absolute bottom-2 left-2 bg-black/60 text-white font-body text-[10px] tracking-wider px-2 py-0.5 rounded-sm">
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Embedded PDF viewer */}
        {article.pdf_url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-14"
          >
            <h2 className="font-display text-lg md:text-xl text-foreground mb-6 text-center tracking-wide">
              View the Full Feature
            </h2>
            <Suspense fallback={
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            }>
              <PdfViewer url={article.pdf_url} title={article.title} />
            </Suspense>
          </motion.div>
        )}

        {/* Article body */}
        {article.content && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-3xl mx-auto px-6 py-10 md:py-14"
          >
            <div
              className="journal-article prose prose-lg max-w-none font-body text-foreground/90
                prose-p:leading-[1.85] prose-p:text-foreground/80 prose-p:my-6
                prose-a:text-primary prose-a:underline prose-a:underline-offset-4
                prose-img:rounded-sm prose-img:w-full
                prose-figcaption:text-center prose-figcaption:text-[13px] prose-figcaption:text-muted-foreground prose-figcaption:mt-4 prose-figcaption:font-body prose-figcaption:tracking-wide prose-figcaption:uppercase"
              dangerouslySetInnerHTML={{ __html: article.content.replace(/(\d+)\.\s/g, '<br /><br />$1. ') .replace(/^<br \/><br \/>/, '') }}
            />
          </motion.div>
        )}

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

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && hasGallery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
            onClick={() => setLightboxIndex(null)}
          >
            <button
              onClick={() => setLightboxIndex(null)}
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Prev / Next */}
            {article.gallery_images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + article.gallery_images.length) % article.gallery_images.length); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/60 hover:text-white transition-colors text-2xl"
                  aria-label="Previous"
                >
                  ‹
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % article.gallery_images.length); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/60 hover:text-white transition-colors text-2xl"
                  aria-label="Next"
                >
                  ›
                </button>
              </>
            )}

            <motion.img
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              src={article.gallery_images[lightboxIndex]}
              alt={`Photo ${lightboxIndex + 1}`}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-sm"
              onClick={(e) => e.stopPropagation()}
            />

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-body text-xs text-white/50">
              {lightboxIndex + 1} / {article.gallery_images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default JournalArticlePage;
