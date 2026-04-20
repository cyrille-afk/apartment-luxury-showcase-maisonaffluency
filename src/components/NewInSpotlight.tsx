import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, type Transition } from "framer-motion";
import { ArrowRight, FileText, Maximize2, Instagram } from "lucide-react";
import ProductCardDescriptionOverlay from "@/components/ui/ProductCardDescriptionOverlay";
import ShareMenu from "@/components/ShareMenu";
import PublicProductLightbox, { type PublicLightboxItem } from "@/components/PublicProductLightbox";
import type { Designer, DesignerCuratorPick } from "@/hooks/useDesigner";
import { useDesignerPicks, useGroupedDesignerPicks } from "@/hooks/useDesigner";
import { useDesignerInstagramPosts } from "@/hooks/useDesignerInstagramPosts";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import SpecSheetButton from "@/components/trade/SpecSheetButton";
import { buildDesignerOgUrl } from "@/lib/whatsapp-share";
import { isParentBrandDesigner } from "@/lib/designerHierarchy";
import { cn } from "@/lib/utils";
import { renderParagraph } from "@/components/EditorialBiography";
import { composeTitle } from "@/lib/curatorPickLegend";

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

interface NewInSpotlightProps {
  designer: Designer;
}

const NewInSpotlight = ({ designer }: NewInSpotlightProps) => {
  const navigate = useNavigate();
  const isParentBrand = isParentBrandDesigner(designer);
  const { data: simplePicks = [] } = useDesignerPicks(designer.id, { publicOnly: true });
  const { data: groupedPicks = [] } = useGroupedDesignerPicks(
    isParentBrand ? designer : undefined,
    { publicOnly: true }
  );
  const picks: DesignerCuratorPick[] = isParentBrand
    ? groupedPicks.map(({ designer_name, designer_slug, ...rest }) => rest)
    : simplePicks;
  const { data: instagramPosts = [] } = useDesignerInstagramPosts(designer.id);
  const [gridCols, setGridCols] = useState<3 | 4>(4);
  const [mobileGridCols, setMobileGridCols] = useState<1 | 2>(2);
  const [ctaPressed, setCtaPressed] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<PublicLightboxItem | null>(null);
  const igWithImages = instagramPosts.filter((p) => p.image_url);

  const portraitImage = designer.hero_image_url || designer.image_url;

  const lightboxItems: PublicLightboxItem[] = useMemo(
    () =>
      picks.map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        image_url: p.image_url,
        hover_image_url: p.hover_image_url,
        brand_name: designer.name,
        materials: p.materials,
        dimensions: p.dimensions,
        description: (p as any).description ?? null,
        category: p.category,
        subcategory: (p as any).subcategory ?? null,
        pdf_url: p.pdf_url,
      })),
    [picks, designer.name]
  );

  const displayName = designer.display_name || designer.name;
  const shareUrl = buildDesignerOgUrl(designer.name);

  // Extract only the first renderable paragraph from the biography
  // (the field contains media URLs, pipe-separated metadata, etc.)
  const firstBioParagraph = useMemo(() => {
    if (!designer.biography) return "";
    const blocks = designer.biography.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
    let text = "";
    for (const block of blocks) {
      const firstToken = block.split(/\s*\|\s*/)[0]?.trim() || "";
      // Skip blocks that start with a URL (media / video references)
      if (/^https?:\/\//i.test(firstToken) && !/\s/.test(firstToken)) continue;
      text = block;
      break;
    }
    // Truncate long paragraphs at a natural sentence-ending marker
    const breakAfter = "contemporary sensibility.";
    const idx = text.toLowerCase().indexOf(breakAfter.toLowerCase());
    if (idx !== -1) {
      text = text.slice(0, idx + breakAfter.length);
    }
    return text;
  }, [designer.biography]);

  return (
    <>
      {/* Portrait + Biography — side by side */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 pt-10 md:pt-16 pb-4 md:pb-6">
        <div className="flex flex-col md:flex-row gap-8 md:gap-14 items-start">
          {/* Portrait */}
          <motion.div
            key={`portrait-${designer.slug}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="w-full md:w-[38%] flex-shrink-0"
          >
            <div className="aspect-[3/2] md:aspect-[4/5] overflow-hidden rounded-sm bg-muted relative">
              <img
                src={portraitImage}
                alt={`${displayName} portrait`}
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>

          {/* Name + Bio + CTA */}
          <motion.div
            key={`bio-${designer.slug}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transition, delay: 0.2 }}
            className="flex-1 flex flex-col justify-start"
          >
            <span className="font-body text-[10px] uppercase tracking-[0.35em] text-muted-foreground mb-2 block">
              New In
            </span>
            <div className="flex items-center gap-3 mb-8">
              <h2 className="font-display text-2xl md:text-3xl lg:text-[2.1rem] text-foreground tracking-[0.12em] uppercase">
                {displayName}
              </h2>
              <ShareMenu
                url={shareUrl}
                message={`Maison Affluency · New In · ${displayName}: ${shareUrl}`}
                className="flex items-center p-1 -m-1 text-foreground/40 hover:text-foreground transition-colors"
                iconSize="w-4 h-4 md:w-5 md:h-5"
                showLabel={false}
              />
            </div>

            <p className="font-body text-sm md:text-base leading-relaxed text-foreground/85 text-left">
              {renderParagraph(firstBioParagraph)}
            </p>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => {
                  if (ctaPressed) return;
                  setCtaPressed(true);
                  window.setTimeout(() => navigate(`/designers/${designer.slug}?expanded=true&from=new-in`), 380);
                }}
                className="group relative inline-flex items-center font-body text-xs uppercase tracking-[0.25em] text-foreground hover:text-primary transition-colors duration-300"
              >
                <span
                  className={cn(
                    "relative inline-flex items-center whitespace-nowrap pl-0 pr-14 transition-[padding] duration-300",
                    "group-hover:pl-20 group-hover:pr-0",
                    ctaPressed && "pl-20 pr-0"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none absolute left-0 top-1/2 h-px w-12 -translate-y-1/2 bg-current opacity-0 transition-all duration-300",
                      "translate-x-2 group-hover:translate-x-0 group-hover:opacity-100",
                      ctaPressed && "translate-x-0 opacity-100"
                    )}
                  />
                  <span className="relative z-10">View The Full Portrait</span>
                  <span
                    className={cn(
                      "pointer-events-none absolute right-5 top-1/2 h-px w-8 -translate-y-1/2 bg-current opacity-100 transition-all duration-300",
                      "translate-x-0 group-hover:translate-x-6 group-hover:opacity-0",
                      ctaPressed && "translate-x-6 opacity-0"
                    )}
                  />
                  <ArrowRight
                    className={cn(
                      "pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-0",
                      ctaPressed && "-translate-x-1 opacity-0"
                    )}
                  />
                </span>
              </button>
            </div>

            {/* From the Studio */}
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
                        alt={post.caption || `${displayName} — From the Studio`}
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
      <section className="max-w-7xl mx-auto px-6 md:px-12 pt-4 md:pt-6 pb-6 md:pb-24">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="px-4 py-1.5 rounded-full border border-foreground/20 bg-foreground/5">
              <h3 className="font-display text-[11px] md:text-xs tracking-[0.2em] uppercase text-foreground font-semibold">Curators' Picks</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile toggle */}
            <button
              onClick={() => setMobileGridCols((prev) => (prev === 1 ? 2 : 1))}
              className="md:hidden flex items-center p-1.5 rounded transition-all hover:opacity-70"
              aria-label={`Switch to ${mobileGridCols === 1 ? 2 : 1} column grid`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                {mobileGridCols === 2 ? (
                  <rect x="4" y="3" width="16" height="18" rx="1" fill="currentColor" />
                ) : (
                  <>
                    <rect x="2" y="3" width="9" height="18" rx="1" fill="currentColor" />
                    <rect x="13" y="3" width="9" height="18" rx="1" fill="currentColor" />
                  </>
                )}
              </svg>
            </button>
            {/* Desktop toggle */}
            <button
              onClick={() => setGridCols((prev) => (prev === 3 ? 4 : 3))}
              className="hidden md:flex items-center p-1.5 rounded transition-all hover:opacity-70"
              aria-label={`Switch to ${gridCols === 3 ? 4 : 3} column grid`}
              title={gridCols === 3 ? "Display 4" : "Display 3"}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                {gridCols === 4 ? (
                  <>
                    <rect x="2" y="3" width="6" height="18" rx="1" fill="currentColor" />
                    <rect x="10" y="3" width="6" height="18" rx="1" fill="currentColor" />
                    <rect x="18" y="3" width="4" height="18" rx="1" fill="currentColor" />
                  </>
                ) : (
                  <>
                    <rect x="2" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                    <rect x="8" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                    <rect x="14" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                    <rect x="20" y="3" width="2" height="18" rx="1" fill="currentColor" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        <div className={cn("grid gap-x-3 gap-y-5 md:gap-4", mobileGridCols === 1 ? "grid-cols-1" : "grid-cols-2", gridCols === 4 ? "md:grid-cols-4" : "md:grid-cols-3")}>
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
              <div
                key={pick.id}
                className="group flex flex-col cursor-pointer"
                onClick={() => {
                  const item = lightboxItems.find((li) => li.id === pick.id);
                  if (item) setLightboxItem(item);
                }}
              >
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
                  <ProductCardDescriptionOverlay description={(pick as any).description} />
                  {(pick.pdf_url || (pick.pdf_urls && pick.pdf_urls.length > 0)) && (
                    <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <SpecSheetButton
                        pdfUrl={pick.pdf_url}
                        pdfUrls={pick.pdf_urls as any}
                        brandName={designer.name}
                        productName={pick.title}
                        variant="icon"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col flex-1">
                  {(() => {
                    const composed = composeTitle(pick.title, pick.subtitle);
                    return (
                      <>
                        <h3 className="font-display text-[11px] md:text-xs tracking-wide leading-snug">{composed.title}</h3>
                        {composed.remainingSubtitle && (
                          <p className="font-body text-[10px] text-muted-foreground leading-tight">{composed.remainingSubtitle}</p>
                        )}
                      </>
                    );
                  })()}
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

      <PublicProductLightbox
        product={lightboxItem}
        allPicks={lightboxItems}
        onClose={() => setLightboxItem(null)}
        onSelectRelated={(item) => setLightboxItem(item)}
      />
    </>
  );
};

export default NewInSpotlight;
