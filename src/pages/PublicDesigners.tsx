import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { useAllDesigners } from "@/hooks/useDesigner";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };

const PublicDesigners = () => {
  const { data: allDesigners = [], isLoading } = useAllDesigners();

  const items = useMemo(
    () =>
      allDesigners
        .filter((d) => d.is_published)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allDesigners]
  );

  return (
    <>
      <Helmet>
        <title>Designers & Makers in Situ — Maison Affluency</title>
        <meta
          name="description"
          content="Discover our curated selection of ateliers and designers — from historical masters to contemporary creators of collectible furniture and lighting."
        />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        <div className="max-w-7xl mx-auto px-6 md:px-12 pt-28 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
            className="mb-10"
          >
            <h1 className="font-display text-3xl md:text-4xl tracking-wide mb-3">
              Designers & Makers in Situ
            </h1>
            <p className="font-body text-sm text-muted-foreground max-w-2xl">
              A curated directory of the ateliers and independent designers whose work defines our collection.
            </p>
          </motion.div>

          {isLoading && (
            <div className="flex items-center justify-center py-32">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <p className="font-body text-sm text-muted-foreground">
                Content coming soon — we're curating this collection.
              </p>
            </div>
          )}

          {!isLoading && items.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
            >
              {items.map((item) => {
                const isAtelier = item.founder === item.name;
                return (
                  <Link
                    key={item.slug}
                    to={`/designers/${item.slug}`}
                    onClick={() => {
                      sessionStorage.removeItem("__scroll_y");
                      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
                    }}
                    className="group block rounded-xl overflow-hidden border border-border hover:border-foreground/30 transition-all hover:shadow-xl bg-background"
                  >
                    <div className="aspect-[3/4] bg-muted/20 overflow-hidden relative">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-[0.65]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted/10 group-hover:bg-muted/20 transition-colors">
                          <span className="font-display text-3xl text-muted-foreground/20">
                            {item.name.charAt(0)}
                          </span>
                        </div>
                      )}

                      {/* Name — top-left */}
                      <div className="absolute inset-x-0 top-0 px-4 pb-10 pt-3 bg-gradient-to-b from-black/60 via-black/25 to-transparent">
                        <p className="font-display text-sm md:text-[15px] text-white tracking-wide leading-tight drop-shadow-sm">
                          {item.name}
                        </p>
                      </div>

                      {isAtelier && (
                        <div className="absolute top-3 right-3 w-16 h-16 md:w-20 md:h-20 bg-foreground flex items-center justify-center p-1.5 overflow-hidden">
                          <span className="font-display text-[7px] md:text-[9px] text-background text-center leading-tight uppercase tracking-[0.12em]">
                            {item.name}
                          </span>
                        </div>
                      )}

                      {item.founder && !isAtelier && (
                        <span className="absolute top-2.5 right-2.5 bg-foreground/75 backdrop-blur-sm text-background font-body text-[8px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full">
                          {item.founder}
                        </span>
                      )}

                      {/* Thumbnail placeholders — bottom-right */}
                      <div className="absolute bottom-3 right-3 flex gap-2 z-10">
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded bg-muted/40 border border-white/15 backdrop-blur-sm" />
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded bg-muted/40 border border-white/15 backdrop-blur-sm" />
                      </div>

                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-4">
                        {item.specialty && (
                          <p className="font-body text-[11px] text-white/85 text-center leading-relaxed line-clamp-3 mb-4 max-w-[90%]">
                            {item.specialty}
                          </p>
                        )}
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/40 bg-white/10 backdrop-blur-sm text-white font-body text-[10px] uppercase tracking-[0.15em] hover:bg-white/20 transition-colors">
                          View Profile
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </motion.div>
          )}

          {/* Trade Program CTA */}
          <div className="mt-16 text-center">
            <Link
              to="/trade"
              className="inline-flex items-center gap-2 px-8 py-3 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-md hover:opacity-90 transition-opacity"
            >
              Join Our Trade Program
            </Link>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default PublicDesigners;
