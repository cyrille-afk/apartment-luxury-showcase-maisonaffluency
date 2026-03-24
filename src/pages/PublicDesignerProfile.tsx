import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowLeft, Package, FileText, Maximize2, Share2, Check } from "lucide-react";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import { useDesigner, useDesignerPicks, useGroupedDesignerPicks } from "@/hooks/useDesigner";
import type { AttributedCuratorPick } from "@/hooks/useDesigner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import WhatsAppShareButton from "@/components/WhatsAppShareButton";
import { shareProfileOnWhatsApp, sharePageOnWhatsApp } from "@/lib/whatsapp-share";
import EditorialBiography, { renderParagraph } from "@/components/EditorialBiography";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PublicProductLightbox, { type PublicLightboxItem } from "@/components/PublicProductLightbox";

const transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };
const reveal = { ...transition, delay: 0.15 };

function responsiveCloudinaryUrl(url: string, width: number): string {
  if (!url.includes("res.cloudinary.com")) return url;
  const replaced = url.replace(/w_\d+/, `w_${width}`);
  if (replaced !== url) return replaced;
  return url.replace("/upload/", `/upload/w_${width},c_fill,q_auto,f_auto/`);
}

function pickSrcSet(url: string): string {
  return [300, 400, 600, 800].map((w) => `${responsiveCloudinaryUrl(url, w)} ${w}w`).join(", ");
}

function displayName(name: string): string {
  if (name.includes(" - ")) {
    const [brand, ...rest] = name.split(" - ");
    return `${brand.trim()} — ${rest.join(" - ").trim()}`;
  }
  return name;
}

const PublicDesignerProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: designer, isLoading } = useDesigner(slug);
  const [gridCols, setGridCols] = useState<3 | 4>(4);
  const [lightboxItem, setLightboxItem] = useState<PublicLightboxItem | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Prevent browser from restoring previous scroll position
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const resetScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetScroll();
    const raf = window.requestAnimationFrame(resetScroll);
    const t1 = window.setTimeout(resetScroll, 50);
    const t2 = window.setTimeout(resetScroll, 150);
    const t3 = window.setTimeout(resetScroll, 400);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [slug]);

  const isParentBrand = designer?.founder === designer?.name;
  const { data: groupedPicks = [] } = useGroupedDesignerPicks(isParentBrand ? designer : undefined);
  const { data: ownPicks = [] } = useDesignerPicks(designer?.id);
  const rawPicks = groupedPicks.length > 0 ? groupedPicks : ownPicks;

  const picks = useMemo(() => {
    if (rawPicks.length <= 2) return rawPicks;

    const getFunctionalCategory = (pick: (typeof rawPicks)[number]) => {
      if (pick.category?.trim()) return pick.category.trim().toLowerCase();
      if (pick.subcategory?.trim()) return pick.subcategory.trim().toLowerCase();
      return "other";
    };

    const columns = isMobile ? Math.max(2, gridCols - 1) : gridCols;

    const buckets = new Map<string, typeof rawPicks>();
    for (const pick of rawPicks) {
      const key = getFunctionalCategory(pick);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(pick);
    }

    const queues = [...buckets.entries()].map(([category, items]) => ({
      category,
      items: [...items],
    }));

    const arranged: typeof rawPicks = [];
    while (arranged.length < rawPicks.length) {
      const index = arranged.length;
      const blockedCategory = index >= columns ? getFunctionalCategory(arranged[index - columns]) : null;

      const candidates = queues
        .filter((q) => q.items.length > 0 && q.category !== blockedCategory)
        .sort((a, b) => b.items.length - a.items.length);

      const fallback = queues
        .filter((q) => q.items.length > 0)
        .sort((a, b) => b.items.length - a.items.length)[0];

      const selected = candidates[0] ?? fallback;
      if (!selected) break;

      arranged.push(selected.items.shift()!);
    }

    return arranged.length === rawPicks.length ? arranged : rawPicks;
  }, [rawPicks, gridCols, isMobile]);

  const isDesignerProfile = designer?.founder && designer.founder !== designer.name;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!designer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-light text-foreground">Designer not found</h1>
          <Link to="/designers" className="text-primary underline underline-offset-4 text-sm">
            Back to directory
          </Link>
        </div>
      </div>
    );
  }

  const name = displayName(designer.name);
  const instagramLink = designer.links.find((l) => l.type === "Instagram")?.url;
  const websiteLink = designer.links.find((l) => l.type === "Website")?.url;
  const heroImage = designer.hero_image_url || designer.image_url;
  const isGrouped = groupedPicks.length > 0;

  /* Split biography into hero paragraphs + remaining (with interleaved media) — same as trade */
  const bioBlocks = designer.biography
    ? designer.biography.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean)
    : [];
  const manualMedia = (designer.biography_images || []).filter(Boolean);
  const curatedMedia = picks.slice(0, 2).map((p) => `${p.image_url} | ${p.title}`);
  const mediaEntries = (manualMedia.length > 0 ? manualMedia : curatedMedia).slice(0, 3);

  let heroParagraphs: string[] = [];
  let remainingBio = "";

  if (bioBlocks.length > 0) {
    if (mediaEntries.length > 0) {
      const chunkCount = mediaEntries.length + 1;
      const chunkSize = Math.max(1, Math.ceil(bioBlocks.length / chunkCount));
      const paragraphChunks = Array.from({ length: chunkCount }, (_, i) =>
        bioBlocks.slice(i * chunkSize, (i + 1) * chunkSize)
      );
      for (let i = 1; i < paragraphChunks.length; i++) {
        if (paragraphChunks[i].length > 0) continue;
        for (let j = i - 1; j >= 0; j--) {
          if (paragraphChunks[j].length > 1) {
            const moved = paragraphChunks[j].pop();
            if (moved) paragraphChunks[i].unshift(moved);
            break;
          }
        }
      }
      heroParagraphs = paragraphChunks[0] || [];
      remainingBio = mediaEntries
        .map((mediaLine, index) => {
          const sectionText = (paragraphChunks[index + 1] || []).join("\n\n");
          return [mediaLine, sectionText].filter(Boolean).join("\n\n");
        })
        .filter(Boolean)
        .join("\n\n");
    } else {
      heroParagraphs = bioBlocks.slice(0, 2);
      remainingBio = bioBlocks.slice(2).join("\n\n");
    }
  }

  return (
    <>
      <Helmet>
        <title>{name} — Maison Affluency</title>
        <meta name="description" content={designer.biography?.slice(0, 155) || designer.specialty} />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        <div className="max-w-6xl mx-auto px-4 md:px-12 pt-32 md:pt-36 pb-20 space-y-8 md:space-y-12">
          <div className="flex items-center justify-between">
            <Link
              to="/#designers"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-body text-[11px] uppercase tracking-[0.15em]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Designers
            </Link>
            <div className="md:hidden">
              <WhatsAppShareButton
                onClick={(e) => {
                  e.stopPropagation();
                  sharePageOnWhatsApp(
                    `/designers/${designer.slug}`,
                    `${designer.name} — Maison Affluency`,
                    designer.specialty || undefined,
                    { directUrlPath: `/designers/${designer.slug}-share.html` }
                  );
                }}
                label="Share"
                size="sm"
                variant="solid"
              />
            </div>
          </div>

          {isDesignerProfile ? (
            /* Designer profile: portrait hero left + quote & opening text right */
            <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={transition}
                  className="relative shrink-0 md:w-[38%]"
                >
                  {heroImage && (
                    <div className="relative rounded-xl overflow-hidden">
                      <img src={heroImage} alt={name} className="w-full h-auto object-contain" loading="eager" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 md:p-6 flex items-end justify-between">
                        <div>
                          <h1 className="font-display text-xl md:text-2xl tracking-wide text-white drop-shadow-md">{name}</h1>
                          {designer.specialty && (
                            <p className="font-body text-xs md:text-sm text-white/80 mt-1 tracking-wide">{designer.specialty}</p>
                          )}
                        </div>
                        <button
                          className="hidden md:inline-flex items-center gap-1.5 font-body text-xs text-white/80 hover:text-white transition-colors uppercase tracking-[0.1em]"
                          title="Copy shareable link"
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = `https://www.maisonaffluency.com/designers/${designer.slug}-share.html`;
                            navigator.clipboard.writeText(url).then(() => {
                              setShareCopied(true);
                              setTimeout(() => setShareCopied(false), 2000);
                            });
                          }}
                        >
                          {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                          {shareCopied ? "Copied!" : "Share"}
                        </button>
                      </div>
                    </div>
                  )}
                  {designer.founder && designer.founder !== designer.name && (
                    <Link
                      to={`/designers/${designer.founder.toLowerCase().replace(/\s+/g, "-")}`}
                      className="absolute top-4 left-4 md:top-6 md:left-6 z-10 w-16 h-16 md:w-20 md:h-20 bg-black text-white font-display text-[7px] md:text-[9px] tracking-[0.12em] uppercase hover:bg-black/80 transition-colors shadow-lg flex items-center justify-center text-center leading-tight overflow-hidden p-1"
                    >
                      {designer.founder}
                    </Link>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...transition, delay: 0.15 }}
                  className="flex-1 min-w-0 flex flex-col justify-center"
                >
                  {designer.philosophy && (
                    <blockquote className="font-display text-base md:text-lg italic leading-snug text-foreground mb-5">
                      "{designer.philosophy}"
                    </blockquote>
                  )}
                  {heroParagraphs.length > 0 && (
                    <div className="font-body text-sm leading-relaxed text-foreground/85">
                      {heroParagraphs.map((p: string, i: number) => (
                        <p key={i} className={i > 0 ? "mt-4" : ""}>{renderParagraph(p)}</p>
                      ))}
                    </div>
                  )}
                 </motion.div>
              </div>

              {remainingBio && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...transition, delay: 0.2 }}
                >
                  <EditorialBiography
                    biography={remainingBio}
                    biographyImages={[]}
                    pickImages={[]}
                    designerName={designer.name}
                  />
                </motion.div>
              )}
            </div>
          ) : (
            /* Atelier profile: panoramic hero + bio below */
            <div className="flex flex-col gap-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={transition}
                className="relative rounded-xl overflow-hidden shrink-0"
              >
                <div className="aspect-[3/2] md:aspect-[2/1] max-h-[50vh]">
                  {heroImage && (
                    <img src={heroImage} alt={name} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: 'center 25%' }} loading="eager" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                </div>

                {designer.founder && designer.founder !== designer.name && (
                  <Link
                    to={`/designers/${designer.founder.toLowerCase().replace(/\s+/g, "-")}`}
                    className="absolute top-4 left-4 md:top-6 md:left-6 z-10 w-16 h-16 md:w-20 md:h-20 bg-black text-white font-display text-[7px] md:text-[9px] tracking-[0.12em] uppercase hover:bg-black/80 transition-colors shadow-lg flex items-center justify-center text-center leading-tight overflow-hidden p-1"
                  >
                    {designer.founder}
                  </Link>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex items-end justify-between">
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={reveal}>
                    <h1 className="font-display text-2xl md:text-4xl tracking-wide text-white drop-shadow-md">{name}</h1>
                    {designer.specialty && (
                      <p className="font-body text-sm md:text-base text-white/80 mt-1.5 font-medium tracking-wide">{designer.specialty}</p>
                    )}
                  </motion.div>
                  <button
                    className="hidden md:inline-flex items-center gap-1.5 font-body text-xs text-white/80 hover:text-white transition-colors uppercase tracking-[0.1em]"
                    title="Copy shareable link"
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = `https://www.maisonaffluency.com/designers/${designer.slug}-share.html`;
                      navigator.clipboard.writeText(url).then(() => {
                        setShareCopied(true);
                        setTimeout(() => setShareCopied(false), 2000);
                      });
                    }}
                  >
                    {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                    {shareCopied ? "Copied!" : "Share"}
                  </button>
                </div>
              </motion.div>

              {designer.biography && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...transition, delay: 0.2 }}
                  className="flex flex-col"
                >
                  {designer.philosophy && (
                    <blockquote className="font-display text-lg md:text-xl italic leading-snug text-foreground mb-6">
                      "{designer.philosophy}"
                    </blockquote>
                  )}

                  {/* Side-by-side: About + opening text on left, first media on right */}
                  {(() => {
                    // remainingBio already has media URLs interleaved as text lines
                    // Split it to extract the first media URL for the hero, keep the rest for EditorialBiography
                    const remainingBlocks = remainingBio
                      ? remainingBio.split(/\n\n+/).map((b: string) => b.trim()).filter(Boolean)
                      : [];

                    // Find first media URL in remainingBlocks
                    let firstMediaIdx = -1;
                    let firstMediaParsed: { url: string; caption: string | null } | null = null;
                    for (let i = 0; i < remainingBlocks.length; i++) {
                      const line = remainingBlocks[i];
                      const pipes = line.split(/\s*\|\s*/);
                      const url = pipes[0]?.trim() || "";
                      if (/^https?:\/\//i.test(url) && /\.(avif|gif|jpe?g|png|webp)(\?|$)/i.test(url) || /res\.cloudinary\.com\/.+\/image\/upload/i.test(url)) {
                        firstMediaParsed = { url, caption: pipes[1]?.trim() || null };
                        firstMediaIdx = i;
                        break;
                      }
                    }

                    // Remove the first media from the remaining bio so EditorialBiography handles the rest
                    const editorialBio = firstMediaIdx >= 0
                      ? [...remainingBlocks.slice(0, firstMediaIdx), ...remainingBlocks.slice(firstMediaIdx + 1)].join("\n\n")
                      : remainingBio;

                    return (
                      <>
                        <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-center">
                          <div className="flex-1 min-w-0">
                            <h2 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">About</h2>
                            <div className="font-body text-sm md:text-[15px] leading-relaxed md:leading-[1.8] text-foreground/85">
                              {heroParagraphs.map((p: string, i: number) => (
                                <p key={i} className={i > 0 ? "mt-4" : ""}>{renderParagraph(p)}</p>
                              ))}
                            </div>
                          </div>
                          {firstMediaParsed && (
                            <div className="shrink-0 w-full md:w-[38%]">
                              <figure>
                                <div className="rounded-xl overflow-hidden bg-muted/10">
                                  <img
                                    src={firstMediaParsed.url}
                                    alt={firstMediaParsed.caption || `${designer.name} — editorial`}
                                    className="w-full h-full object-contain"
                                    loading="lazy"
                                  />
                                </div>
                                {firstMediaParsed.caption && (
                                  <figcaption className="mt-2 font-body text-[13px] tracking-wide text-muted-foreground italic text-center md:text-left">
                                    {firstMediaParsed.caption}
                                  </figcaption>
                                )}
                              </figure>
                            </div>
                          )}
                        </div>

                        {editorialBio && (
                          <div className="mt-10 md:mt-14">
                            <EditorialBiography
                              biography={editorialBio}
                              biographyImages={[]}
                              pickImages={[]}
                              designerName={designer.name}
                            />
                          </div>
                        )}
                      </>
                    );
                  })()}
                </motion.div>
              )}
            </div>
          )}

          {picks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, delay: 0.25 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground">Curators' Picks</h2>
                <button
                  onClick={() => setGridCols((prev) => (prev === 3 ? 4 : 3))}
                  className="flex items-center p-1.5 rounded transition-all hover:opacity-70"
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

              <div className={cn("grid gap-x-3 gap-y-5 md:gap-4", gridCols === 4 ? "grid-cols-3 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3")}>
                {picks.map((pick) => {
                  const ap = pick as AttributedCuratorPick;
                  const designerLabel = isGrouped && ap.designer_name && ap.designer_name !== designer.name ? ap.designer_name : undefined;
                  const designerSlug = isGrouped && ap.designer_slug ? ap.designer_slug : undefined;
                  const hasMultipleSizes = !!pick.dimensions && pick.dimensions.includes("\n");

                  return (
                    <div
                      key={pick.id}
                      className="group flex flex-col cursor-pointer"
                      onClick={() => setLightboxItem({
                        id: pick.id,
                        title: pick.title,
                        subtitle: pick.subtitle,
                        image_url: pick.image_url,
                        hover_image_url: pick.hover_image_url,
                        brand_name: designer.name,
                        materials: pick.materials,
                        dimensions: pick.dimensions,
                        category: pick.category,
                        subcategory: pick.subcategory,
                        pdf_url: pick.pdf_url,
                      })}
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
                        {pick.hover_image_url && (() => {
                          const hoverPosTag = pick.tags?.find((t) => t.startsWith("hover-pos:"));
                          const hoverPos = hoverPosTag ? hoverPosTag.replace("hover-pos:", "") : undefined;
                          return (
                            <img
                              src={responsiveCloudinaryUrl(pick.hover_image_url, 600)}
                              srcSet={pickSrcSet(pick.hover_image_url)}
                              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
                              alt={`${pick.title} hover view`}
                              className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                              style={hoverPos ? { objectPosition: hoverPos } : undefined}
                              loading="lazy"
                            />
                          );
                        })()}
                        {pick.tags && pick.tags.length > 0 && (() => {
                          const collectionTags = pick.tags.filter((t) =>
                            /couture|edition|limited|modern scholar|unesco|good design award/i.test(t)
                          );
                          return collectionTags.length > 0 ? (
                            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                              {collectionTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-block px-2 py-0.5 text-[8px] md:text-[9px] uppercase tracking-wider font-body bg-black/50 text-white/90 rounded-full border border-black/20 backdrop-blur-sm"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null;
                        })()}
                        <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="p-1.5 bg-black/40 rounded-md text-white/90 backdrop-blur-sm">
                            <Maximize2 className="h-3 w-3" />
                          </div>
                        </div>
                        {pick.pdf_url && (
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
                        {designerLabel && designerSlug ? (
                          <Link
                            to={`/designers/${designerSlug}`}
                            className="block font-body text-[10px] md:text-[11px] text-primary/70 hover:text-primary underline underline-offset-2 leading-tight mt-0.5"
                          >
                            {designerLabel}
                          </Link>
                        ) : designerLabel ? (
                          <span className="block font-body text-[10px] md:text-[11px] text-muted-foreground leading-tight mt-0.5">
                            {designerLabel}
                          </span>
                        ) : null}
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
                          {pick.edition && (
                            <p className="font-body text-[9px] text-primary/70 mt-0.5 italic">{pick.edition}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {picks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/10 rounded-xl">
              <Package className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="font-body text-sm text-muted-foreground">Curators' picks coming soon</p>
            </div>
          )}

          <div className="text-center py-8">
            <p className="font-body text-sm text-muted-foreground mb-4">Interested in pieces from this collection?</p>
            <Link
              to="/trade/program"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background font-display text-xs tracking-[0.15em] uppercase rounded-full hover:bg-foreground/90 transition-colors"
            >
              Join Our Trade Program
            </Link>
          </div>
        </div>

        <Footer />
      </div>

      <PublicProductLightbox
        product={lightboxItem}
        allPicks={picks.map((p) => ({
          id: p.id,
          title: p.title,
          subtitle: p.subtitle,
          image_url: p.image_url,
          hover_image_url: p.hover_image_url,
          brand_name: designer?.name || "",
          materials: p.materials,
          dimensions: p.dimensions,
          category: p.category,
          subcategory: p.subcategory,
          pdf_url: p.pdf_url,
        }))}
        onClose={() => setLightboxItem(null)}
        onSelectRelated={(item) => setLightboxItem(item)}
      />
    </>
  );
};

export default PublicDesignerProfile;
