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
import { usePublicRrpMap, formatPublicRrp } from "@/hooks/usePublicRrp";
import { PortraitCtaLink } from "@/components/ui/portrait-cta-link";

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
  showEyebrow?: boolean;
}

const NewInSpotlight = ({ designer, showEyebrow = true }: NewInSpotlightProps) => {
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
  const { data: publicRrpMap = {} } = usePublicRrpMap(picks.map((p) => p.id));
  const { data: instagramPosts = [] } = useDesignerInstagramPosts(designer.id);
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
        materials_description: (p as any).materials_description ?? null,
        dimensions: p.dimensions,
        lead_time: (p as any).lead_time ?? null,
        origin: (p as any).origin ?? null,
        description: (p as any).description ?? null,
        category: p.category,
        subcategory: (p as any).subcategory ?? null,
        pdf_url: p.pdf_url,
        designer_slug: designer.slug,
        size_variants: (p as any).size_variants ?? null,
        variant_placeholder: (p as any).variant_placeholder ?? null,
        base_axis_label: (p as any).base_axis_label ?? null,
        top_axis_label: (p as any).top_axis_label ?? null,
        gallery_images: (p as any).gallery_images ?? null,
        variant_image_map: (p as any).variant_image_map ?? null,
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
      <div className="w-full max-w-[1440px] mx-auto px-12 lg:px-16 bg-transparent">
        {/* Portrait + Biography — side by side */}
        <section className="pt-2 md:pt-4">
          <div className="flex flex-col md:flex-row justify-between items-start w-full gap-8 mb-12">
            {/* Portrait */}
            <motion.div
              key={`portrait-${designer.slug}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="w-full md:w-[25%] aspect-[4/3] overflow-hidden bg-neutral-50 flex-shrink-0"
            >
              <img
                src={portraitImage}
                alt={`${displayName} portrait`}
                className="w-full h-full object-cover"
              />
            </motion.div>

            {/* Name + Bio + CTA */}
            <motion.div
              key={`bio-${designer.slug}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, delay: 0.2 }}
              className="w-full md:w-[71%] flex flex-col justify-between pt-0"
            >
              {showEyebrow && (
                <span className="font-body text-[10px] uppercase tracking-[0.35em] text-muted-foreground block mb-5">
                  New In
                </span>
              )}
              <div className="flex items-center gap-3 mb-5">
                <h2 className="text-2xl font-serif font-normal tracking-wide text-neutral-900">
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

              <p className="text-[13px] lg:text-sm text-neutral-600 leading-relaxed text-justify w-full mb-4">
                {renderParagraph(firstBioParagraph)}
              </p>

              <PortraitCtaLink
                label="View The Full Portrait"
                className="text-[10px] uppercase tracking-widest font-medium text-neutral-800 border-b border-neutral-400 pb-0.5 inline-flex items-center gap-2 mb-4"
                onClick={() => {
                  if (ctaPressed) return;
                  setCtaPressed(true);
                  window.setTimeout(() => navigate(`/designers/${designer.slug}/biography?from=new-in`), 380);
                }}
              />

              {igWithImages.length > 0 && (
                <div className="w-full border-t border-neutral-200 pt-4 mt-4">
                  <span className="text-[10px] uppercase tracking-widest text-neutral-400 block mb-3">
                    From the Studio
                  </span>
                  <div className="flex items-center gap-1.5 w-full h-12 overflow-hidden">
                    {igWithImages.slice(0, 6).map((post) => (
                      <a
                        key={post.id}
                        href={post.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block flex-shrink-0 h-full"
                      >
                        <img
                          src={post.image_url}
                          alt="Studio insight"
                          className="h-full aspect-[4/3] md:aspect-[16/9] object-cover bg-neutral-50 flex-shrink-0 grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* Separator */}
        <div className="border-t border-border/40" />

        {/* Curators' Picks */}
        <section className="w-full pt-4 md:pt-6 pb-6 md:pb-24">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[11px] font-sans font-medium uppercase tracking-[0.2em] text-neutral-800">Curators' Picks</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-16 w-full">
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
                className="w-full group flex flex-col cursor-pointer"
                onClick={() => {
                  const item = lightboxItems.find((li) => li.id === pick.id);
                  if (item) setLightboxItem(item);
                }}
              >
                <div className="aspect-[4/5] bg-muted/20 rounded-none overflow-hidden mb-2 relative flex items-center justify-center">
                  <img
                    src={responsiveCloudinaryUrl(pick.image_url, 600)}
                    srcSet={pickSrcSet(pick.image_url)}
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
                    alt={pick.title}
                    className={cn(
                      "absolute inset-0 w-full h-full transition-all duration-700 object-cover",
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
                      className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                      loading="lazy"
                    />
                  )}
                  {specialTags.length > 0 && (
                    <div className="absolute top-3 left-3 bg-white/90 border border-neutral-100 px-2 py-0.5 rounded-none backdrop-blur-sm z-10 flex flex-wrap gap-1">
                      {specialTags.map((tag, i) => (
                        <span
                          key={i}
                          className="text-[9px] font-sans font-medium uppercase tracking-widest text-neutral-500"
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
                      {formatPublicRrp(publicRrpMap[pick.id]) || "Price upon request"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </section>
      </div>

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
