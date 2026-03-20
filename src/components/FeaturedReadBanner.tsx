import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABELS, type JournalCategory } from "@/lib/journal";

interface FeaturedArticle {
  slug: string;
  title: string;
  category: JournalCategory;
  author: string;
}

const DISMISS_KEY = "featured-read-dismissed";

const FeaturedReadBanner = () => {
  const [article, setArticle] = useState<FeaturedArticle | null>(null);
  const [visible, setVisible] = useState(false);
  const [navHeight, setNavHeight] = useState(96);
  const location = useLocation();

  // On the homepage the nav is position:fixed, so we need position:fixed too.
  // On journal/article pages the nav is position:sticky in normal flow, so we stay in flow.
  const isHomepage = location.pathname === "/";

  useEffect(() => {
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (dismissed) return;

    supabase
      .from("journal_articles")
      .select("slug, title, category, author")
      .eq("is_published", true)
      .eq("is_featured", true)
      .order("published_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setArticle(data[0] as FeaturedArticle);
          setVisible(true);
        }
      });
  }, []);

  // Measure the fixed nav height (homepage only)
  const measureNav = useCallback(() => {
    const nav = document.querySelector("nav");
    if (!nav) return false;
    const measured = nav.getBoundingClientRect().height;
    if (measured > 0) {
      setNavHeight(measured);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!isHomepage) return;

    const hasMeasuredImmediately = measureNav();
    const interval = window.setInterval(() => {
      const measured = measureNav();
      if (measured) window.clearInterval(interval);
    }, hasMeasuredImmediately ? 600 : 150);

    window.addEventListener("resize", measureNav);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", measureNav);
    };
  }, [isHomepage, measureNav]);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISS_KEY, "1");
  };

  const inner = (
    <div className="max-w-7xl mx-auto px-4 md:px-12 py-2 flex items-center justify-between gap-4">
      <Link
        to={`/journal/${article?.slug}`}
        className="flex items-center gap-3 min-w-0 group"
      >
        <span className="shrink-0 font-body text-[9px] uppercase tracking-[0.18em] text-primary font-semibold">
          Featured Read
        </span>
        <span className="hidden sm:inline text-border/60">|</span>
        <span className="font-display text-sm text-foreground group-hover:text-primary transition-colors truncate">
          {article?.title}
        </span>
        <span className="hidden md:inline font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground shrink-0">
          {article ? CATEGORY_LABELS[article.category] : ""}
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
      </Link>
      <button
        onClick={dismiss}
        className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <AnimatePresence>
      {visible && article && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={
            isHomepage
              ? "fixed left-0 right-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm"
              : "border-b border-border bg-primary/[0.04]"
          }
          style={isHomepage ? { top: navHeight } : undefined}
        >
          {inner}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FeaturedReadBanner;
