import { lazy, Suspense, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { motion, type Transition } from "framer-motion";
import { ArrowRight, FileText, Maximize2, Instagram } from "lucide-react";
import ShareMenu from "@/components/ShareMenu";
import Navigation from "@/components/Navigation";
import { useDesigner, useDesignerPicks } from "@/hooks/useDesigner";
import { useDesignerInstagramPosts } from "@/hooks/useDesignerInstagramPosts";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import { cn } from "@/lib/utils";

const Footer = lazy(() => import("@/components/Footer"));

const DESIGNER_SLUG = "pierre-bonnefille";

const BIOGRAPHY = `Pierre Bonnefille is a French artist, painter, designer and 'Maître d'Art' — a title awarded by the French Ministry of Culture to masters of exceptional craft. A graduate of both the École Boulle and the École Nationale Supérieure des Arts Décoratifs in Paris, he has spent more than three decades creating his own materials, mixing pigments with sand and ground rock, sometimes applying gold or silver leaf on top, other times stamping the surface with fabric to leave behind what he calls a 'textile fossil', his signature textures.`;

const PORTRAIT_IMAGE = "https://s30964.pcdn.co/introspective-magazine/wp-content/uploads/2019/12/hero-2-1024x512.jpg";

const transition: Transition = { duration: 0.7, ease: [0.16, 1, 0.3, 1] };

function responsiveCloudinaryUrl(url: string, width: number): string {
  if (!url.includes("res.cloudinary.com")) return url;
  const replaced = url.replace(/w_\d+/, `w_${width}`);
  if (replaced !== url) return replaced;
  return url.replace("/upload/", `/upload/w_${width},c_limit,f_auto,q_auto/`);
}

function pickSrcSet(url: string): string {
  return [300, 400, 600, 800].map((w) => `${responsiveCloudinaryUrl(url, w)} ${w}w`).join(", ");
}

const NewIn = () => {
  const navigate = useNavigate();
  const { data: designer } = useDesigner(DESIGNER_SLUG);
  const { data: picks = [] } = useDesignerPicks(designer?.id, { publicOnly: true });
  const { data: instagramPosts = [] } = useDesignerInstagramPosts(designer?.id);
  const [gridCols, setGridCols] = useState<3 | 4>(4);
  const [mobileGridCols, setMobileGridCols] = useState<1 | 2>(2);
  const [ctaPressed, setCtaPressed] = useState(false);
  const igWithImages = instagramPosts.filter((p) => p.image_url);

  return (
    <>
      <Helmet>
        <title>New In — Pierre Bonnefille | Maison Affluency</title>
        <meta name="description" content="Discover Pierre Bonnefille — French artist, painter, designer and Maître d'Art. Explore his curated collection of sculptural works at Maison Affluency." />
        <meta property="og:title" content="New In — Pierre Bonnefille | Maison Affluency" />
        <meta property="og:description" content="Discover Pierre Bonnefille — French artist, painter, designer and Maître d'Art. Explore his curated collection at Maison Affluency." />
        <meta property="og:image" content={PORTRAIT_IMAGE} />
        <meta property="og:url" content="https://www.maisonaffluency.com/new-in" />
        <meta property="og:type" content="article" />
      </Helmet>

      <Navigation />

      {/* Portrait + Biography — side by side */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 pt-10 md:pt-16 pb-4 md:pb-6 mt-[96px]">
        <div className="flex flex-col md:flex-row gap-8 md:gap-14 items-start">
          {/* Portrait */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="w-full md:w-[38%] flex-shrink-0"
          >
            <div className="aspect-[3/2] md:aspect-[4/5] overflow-hidden rounded-sm bg-muted">
              <img
                src={PORTRAIT_IMAGE}
                alt="Pierre Bonnefille in his atelier"
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>

          {/* Name + Bio + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transition, delay: 0.2 }}
            className="flex-1 flex flex-col justify-start"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                New In
              </span>
              <ShareMenu
                url="https://www.maisonaffluency.com/new-in-og.html"
                message="Maison Affluency · New In · Pierre Bonnefille — French artist, painter, designer and Maître d'Art: https://www.maisonaffluency.com/new-in-og.html"
                className="flex items-center p-1 -m-1 text-foreground/50 hover:text-foreground transition-colors"
                iconSize="w-6 h-6"
                showLabel={false}
              />
            </div>
            <h1 className="font-display text-2xl md:text-3xl lg:text-[2.1rem] text-foreground tracking-[0.12em] uppercase mb-8">
              Pierre Bonnefille
            </h1>

            <p className="font-body text-sm md:text-base leading-relaxed text-foreground/85 text-left">
              {BIOGRAPHY}
            </p>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => {
                  if (ctaPressed) return;
                  setCtaPressed(true);
                  window.setTimeout(() => navigate(`/designers/${DESIGNER_SLUG}?expanded=true`), 380);
                }}
                className="group inline-flex items-center font-body text-xs uppercase tracking-[0.25em] text-foreground hover:text-primary transition-colors duration-300"
              >
                <span className={cn("inline-flex items-center transition-transform duration-300", ctaPressed && "translate-x-4")}>
                  <span className="inline-flex w-8 items-center justify-start overflow-hidden">
                    <span className={cn("h-px w-8 bg-current transition-all duration-300", ctaPressed ? "translate-x-8 opacity-0" : "translate-x-0 opacity-100")} />
                  </span>
                  <span className="mx-3">View The Full Portrait</span>
                  <span className="inline-flex w-8 items-center justify-start overflow-hidden">
                    <span className={cn("h-px w-8 bg-current transition-all duration-300", ctaPressed ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0")} />
                  </span>
                </span>
                <ArrowRight className={cn("ml-3 h-3.5 w-3.5 transition-all duration-300", ctaPressed && "-translate-x-1 opacity-0")} />
              </button>
            </div>

            {/* From the Studio — inside right column, side by side with hero */}
            {igWithImages.length > 0 && (
              <div className="mt-10 pt-8 border-t border-border/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-foreground/15" />
                  <div className="flex items-center gap-2 shrink-0">
                    <Instagram className="w-3.5 h-3.5 text-foreground/60" />
                    <span className="font-display text-[10px] md:text-[11px] tracking-[0.2em] uppercase text-foreground/60 font-semibold">
                      From the Studio
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-foreground/15" />
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-1">
                  {igWithImages.slice(0, 6).map((post, index) => (
                    <a
                      key={post.id}
                      href={post.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group relative block aspect-square overflow-hidden bg-muted ${index >= 3 ? "hidden md:block" : ""}`}
                    >
                      <img
                        src={post.image_url!}
                        alt={post.caption || "Pierre Bonnefille — From the Studio"}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors duration-300 flex items-center justify-center">
                        <Instagram className="h-4 w-4 text-background opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Separator */}
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="border-t border-border/40" />
      </div>

      {/* Curators' Picks */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 pt-4 md:pt-6 pb-16 md:pb-24">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="px-4 py-1.5 rounded-full border border-foreground/20 bg-foreground/5">
              <h2 className="font-display text-[11px] md:text-xs tracking-[0.2em] uppercase text-foreground font-semibold">Curators' Picks</h2>
            </div>
          </div>
          <button
            onClick={() => setGridCols((prev) => (prev === 3 ? 4 : 3))}
            className="hidden md:flex items-center p-1.5 rounded transition-all hover:opacity-70"
            aria-label={`Switch to ${gridCols === 3 ? 4 : 3} column grid`}
            title={gridCols === 3 ? "Display 4" : "Display 3"}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              {gridCols === 3 ? (
                <>
                  <rect x="2" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                  <rect x="8" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                  <rect x="14" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                  <rect x="20" y="3" width="2" height="18" rx="1" fill="currentColor" opacity={0.35} />
                </>
              ) : (
                <>
                  <rect x="2" y="3" width="6" height="18" rx="1" fill="currentColor" />
                  <rect x="10" y="3" width="6" height="18" rx="1" fill="currentColor" />
                  <rect x="18" y="3" width="4" height="18" rx="1" fill="currentColor" opacity={0.35} />
                </>
              )}
            </svg>
          </button>
        </div>

        <div className={cn("grid gap-x-3 gap-y-5 md:gap-4 grid-cols-2", gridCols === 4 ? "md:grid-cols-4" : "md:grid-cols-3")}>
          {picks.map((pick) => {
            const hasEdition = !!pick.edition;
            const tags: string[] = (pick as any).tags || [];
            const filtered = hasEdition ? tags.filter(t => !/^limited-edition$/i.test(t)) : tags;
            const specialTags = filtered.filter((t) =>
              /couture|edition|limited|re-edition|unique|modern scholar|unesco|good design award|genesis collection/i.test(t)
            );
            if (pick.edition && !specialTags.some(t => t.toLowerCase() === pick.edition!.toLowerCase())) {
              specialTags.unshift(pick.edition);
            }

            return (
              <div key={pick.id} className="group flex flex-col">
                <div className="aspect-[4/5] bg-muted/20 rounded-xl overflow-hidden mb-2 relative flex items-center justify-center">
                  <img
                    src={responsiveCloudinaryUrl(pick.image_url, 600)}
                    srcSet={pickSrcSet(pick.image_url)}
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
                    alt={pick.title}
                    className={cn(
                      "absolute inset-0 w-full h-full transition-all duration-700 rounded-xl object-cover",
                      pick.hover_image_url ? "opacity-100 group-hover:opacity-0 group-hover:scale-105" : "group-hover:scale-105"
                    )}
                    loading="lazy"
                  />
                  {pick.hover_image_url && (
                    <img
                      src={responsiveCloudinaryUrl(pick.hover_image_url, 600)}
                      srcSet={pickSrcSet(pick.hover_image_url)}
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
                      alt={`${pick.title} alternate finish`}
                      className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                      loading="lazy"
                    />
                  )}
                  {specialTags.length > 0 && (
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      {specialTags.map((tag, i) => (
                        <span
                          key={i}
                          className="inline-block px-2 py-0.5 text-[8px] md:text-[9px] uppercase tracking-wider font-body bg-black/50 text-white/90 rounded-full border border-black/20 backdrop-blur-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-1.5 bg-black/40 rounded-md text-white/90 backdrop-blur-sm">
                      <Maximize2 className="h-3 w-3" />
                    </div>
                  </div>
                  {pick.pdf_url && designer && (
                    <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={buildSpecSheetUrl(pick.pdf_url, designer.name, pick.title)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 bg-[hsl(var(--pdf-red))]/80 rounded-md text-white hover:bg-[hsl(var(--pdf-red))] transition-colors"
                        title="Spec sheet"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex flex-col flex-1">
                  <h3 className="font-display text-[11px] md:text-xs tracking-wide leading-snug">{pick.title}</h3>
                  {pick.subtitle && <p className="font-body text-[10px] text-muted-foreground leading-tight">{pick.subtitle}</p>}
                  {pick.materials && (
                    <p className="font-body text-[9px] text-muted-foreground/60 mt-0.5 line-clamp-2 leading-relaxed">
                      {pick.materials}
                    </p>
                  )}
                  {pick.dimensions && (
                    <p className="font-body text-[9px] text-muted-foreground/50 mt-0.5">
                      {pick.dimensions
                        .split("\n")
                        .filter((line: string) => !line.toLowerCase().includes(" in"))
                        .join("\n")}
                    </p>
                  )}
                  <div className="mt-auto pt-1">
                    <p className="font-display text-[11px] md:text-xs text-foreground">
                      Price on request
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Separator */}
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="border-t border-border/40" />
      </div>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
};

export default NewIn;
