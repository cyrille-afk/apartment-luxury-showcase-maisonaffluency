import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, X } from "lucide-react";
import ShareMenu from "@/components/ShareMenu";
import { motion, AnimatePresence } from "framer-motion";
import React from "react";
import JournalMarkdown from "@/components/journal/JournalMarkdown";

import { fetchArticleBySlug, CATEGORY_LABELS, type JournalArticle as Article } from "@/lib/journal";
import { useAuth } from "@/hooks/useAuth";

const PdfViewer = lazy(() => import("@/components/journal/PdfViewer"));

/** Detect if a paragraph's children consist solely of a single <strong> element (no surrounding text) */
const isBoldOnlyParagraph = (children: React.ReactNode): boolean => {
  const arr = React.Children.toArray(children);
  return arr.length === 1 && React.isValidElement(arr[0]) && (arr[0] as React.ReactElement).type === 'strong';
};

const JournalParagraph = ({ node, children, ...props }: any) => {
  const cls = isBoldOnlyParagraph(children)
    ? "leading-[1.85] text-foreground/80 my-6 journal-subheader"
    : "leading-[1.85] text-foreground/80 my-6";
  return <p className={cls} {...props}>{children}</p>;
};

const JournalArticlePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loading: authLoading, user } = useAuth();
  const isPreview = searchParams.get("preview") === "true";
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;

    if (isPreview && authLoading) {
      return;
    }

    if (isPreview && !user) {
      navigate("/trade/login", { replace: true });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchArticleBySlug(slug, isPreview)
      .then((data) => {
        if (!cancelled) setArticle(data);
      })
      .catch(() => {
        if (!cancelled) navigate("/journal", { replace: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, navigate, isPreview, authLoading, user]);

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
            <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {formatDate(article.published_at)}
            </span>
          </div>
        </div>

        {/* Cover image */}
        {article.cover_image_url && (
          <div className="relative w-full flex flex-col items-center bg-muted/10 px-4 md:px-0 group">
            <img
              src={article.cover_image_url}
              alt={article.title}
              className="w-full max-w-4xl mx-auto object-contain"
            />
            {/* Share icon overlay */}
            <div className="max-w-4xl w-full mx-auto relative">
              <div className="absolute bottom-3 right-3 md:bottom-4 md:right-4 z-10">
              <ShareMenu
                url={`https://www.maisonaffluency.com/journal/${article.slug}-og.html`}
                message={`${article.title} — Maison Affluency: https://www.maisonaffluency.com/journal/${article.slug}-og.html`}
                className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md text-white/90 hover:text-white px-3 py-2 rounded-full transition-colors"
                iconSize="w-4 h-4"
                showLabel={false}
              />
              </div>
            </div>
            {article.slug === "thierry-lemaire-radical-simplicity" && (
              <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground py-3">
                Unveiling master pieces, Maison Affluency, Singapore. Photography by Hosanna Swee
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

        {/* Gallery images are now rendered inline within article content */}

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

        {/* Article body with inline gallery images */}
        {article.content && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-3xl mx-auto px-6 py-6 md:py-14"
          >
            <div className="journal-article prose prose-lg max-w-none font-body text-foreground/90 prose-img:rounded-sm prose-img:w-full prose-figcaption:text-center prose-figcaption:text-[13px] prose-figcaption:text-muted-foreground prose-figcaption:mt-4 prose-figcaption:font-body prose-figcaption:tracking-wide prose-figcaption:uppercase">
              {/* Helper: detect paragraphs that contain ONLY a <strong> with no surrounding text */}
              {(() => {
                // Parse gallery images
                const galleryItems = (article.gallery_images || []).map((raw) => {
                  const parts = raw.split(' | ');
                  return { url: parts[0].trim(), caption: parts[1]?.trim() || null };
                });

                // If no gallery images, render content as-is
                if (galleryItems.length === 0) {
                  return (
                    <JournalMarkdown
                      content={article.content}
                      onPairImageClick={(url) => window.open(url, "_blank", "noopener,noreferrer")}
                      components={{
                        h2: ({ node, ...props }) => <h2 className="font-display text-lg md:text-xl uppercase tracking-[0.08em] border-t border-border pt-10 md:pt-16 mt-10 md:mt-16" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="font-display text-base md:text-lg tracking-wide mt-8 mb-4" {...props} />,
                        p: JournalParagraph,
                        a: ({ node, children, ...props }) => {
                          let href = props.href || "";
                          const sitePattern = /^https?:\/\/(www\.)?maisonaffluency\.com/;
                          if (sitePattern.test(href)) {
                            href = href.replace(sitePattern, "");
                          }
                          if (href.startsWith("/designers/") && !href.includes("from_journal")) {
                            const sep = href.includes("?") ? "&" : "?";
                            href = `${href}${sep}from_journal=${article.slug}`;
                          }
                          const isExternal = href.startsWith("http");
                          if (!isExternal && href.startsWith("/")) {
                            return (
                              <Link to={href} className="text-primary underline underline-offset-4">
                                {children}
                              </Link>
                            );
                          }
                          return (
                            <a
                              {...props}
                              href={href}
                              className="text-primary underline underline-offset-4"
                              target={isExternal ? "_blank" : undefined}
                              rel={isExternal ? "noopener noreferrer" : undefined}
                            >
                              {children}
                            </a>
                          );
                        },
                        blockquote: ({ node, ...props }) => <blockquote className="border-l-[3px] border-primary pl-6 italic font-serif my-6" {...props} />,
                        strong: ({ node, ...props }) => <strong className="text-foreground font-semibold" {...props} />,
                        hr: ({ node, ...props }) => <hr className="my-10 border-border" {...props} />,
                        ul: ({ node, ...props }) => <ul className="my-6 list-disc pl-6 space-y-2" {...props} />,
                        ol: ({ node, ...props }) => <ol className="my-6 list-decimal pl-6 space-y-2" {...props} />,
                      }}
                    />
                  );
                }

                // Split content by ## headings to interleave images
                const sections = article.content.split(/(?=^## )/m);

                const mdComponents = {
                  h2: ({ node, ...props }: any) => <h2 className="font-display text-lg md:text-xl uppercase tracking-[0.08em] border-t border-border pt-10 md:pt-16 mt-10 md:mt-16" {...props} />,
                  h3: ({ node, ...props }: any) => <h3 className="font-display text-base md:text-lg tracking-wide mt-8 mb-4" {...props} />,
                  p: JournalParagraph,
                  a: ({ node, children, ...props }: any) => {
                    let href = props.href || "";
                    // Convert full site URLs to relative paths
                    const sitePattern = /^https?:\/\/(www\.)?maisonaffluency\.com/;
                    if (sitePattern.test(href)) {
                      href = href.replace(sitePattern, "");
                    }
                    if (href.startsWith("/designers/") && !href.includes("from_journal")) {
                      const sep = href.includes("?") ? "&" : "?";
                      href = `${href}${sep}from_journal=${article.slug}`;
                    }
                    const isExternal = href.startsWith("http");
                    if (!isExternal && href.startsWith("/")) {
                      return (
                        <Link to={href} className="text-primary underline underline-offset-4">
                          {children}
                        </Link>
                      );
                    }
                    return (
                      <a
                        {...props}
                        href={href}
                        className="text-primary underline underline-offset-4"
                        target={isExternal ? "_blank" : undefined}
                        rel={isExternal ? "noopener noreferrer" : undefined}
                      >
                        {children}
                      </a>
                    );
                  },
                  blockquote: ({ node, ...props }: any) => <blockquote className="border-l-[3px] border-primary pl-6 italic font-serif my-6" {...props} />,
                  strong: ({ node, ...props }: any) => <strong className="text-foreground font-semibold" {...props} />,
                  hr: ({ node, ...props }: any) => <hr className="my-10 border-border" {...props} />,
                  ul: ({ node, ...props }: any) => <ul className="my-6 list-disc pl-6 space-y-2" {...props} />,
                  ol: ({ node, ...props }: any) => <ol className="my-6 list-decimal pl-6 space-y-2" {...props} />,
                };

                // Assign one gallery image to the end of each designer ## section (skip intro heading)
                // Count designer sections (skip the first ## which is the intro)
                let h2Count = 0;
                const sectionImageMap: (typeof galleryItems[0] | null)[] = sections.map((section) => {
                  const isH2 = section.startsWith('## ');
                  if (isH2) h2Count++;
                  // Assign images to designer sections (2nd ## onward)
                  if (isH2 && h2Count > 1) {
                    const idx = h2Count - 2; // 0-based index into gallery
                    return idx < galleryItems.length ? galleryItems[idx] : null;
                  }
                  return null;
                });

                return sections.map((section, i) => {
                  const image = sectionImageMap[i];
                  const imageIdx = image ? galleryItems.indexOf(image) : -1;

                  return (
                    <div key={i}>
                      <JournalMarkdown
                        content={section}
                        components={mdComponents}
                        onPairImageClick={(url) => window.open(url, "_blank", "noopener,noreferrer")}
                      />
                      {image && (
                        <figure className="my-8 md:my-12">
                          <button
                            onClick={() => setLightboxIndex(imageIdx)}
                            className="relative block w-full group cursor-pointer"
                          >
                            <img
                              src={image.url}
                              alt={image.caption || `${article.title} — Photo ${imageIdx + 1}`}
                              className="w-full rounded-sm object-cover transition-all duration-300 group-hover:shadow-lg group-hover:brightness-95"
                              loading="lazy"
                            />
                          </button>
                          {image.caption && (
                            <figcaption className="mt-2 font-body text-[11px] tracking-wide text-muted-foreground italic text-center">
                              {image.caption}
                            </figcaption>
                          )}
                        </figure>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
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

            {(() => {
              const parts = article.gallery_images[lightboxIndex].split(' | ');
              const imgUrl = parts[0].trim();
              const caption = parts[1]?.trim() || null;
              return (
                <>
                  <motion.img
                    key={lightboxIndex}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    src={imgUrl}
                    alt={caption || `Photo ${lightboxIndex + 1}`}
                    className="max-w-[90vw] max-h-[85vh] object-contain rounded-sm"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
                    {caption && (
                      <div className="font-body text-xs text-white/70 italic mb-1">{caption}</div>
                    )}
                    <div className="font-body text-[10px] text-white/40">
                      {lightboxIndex + 1} / {article.gallery_images.length}
                    </div>
                  </div>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default JournalArticlePage;
