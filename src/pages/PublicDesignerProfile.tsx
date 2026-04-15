import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, Link, Navigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Package, FileText, Maximize2, Share2, Check, ChevronDown } from "lucide-react";
import ProductCardDescriptionOverlay from "@/components/ui/ProductCardDescriptionOverlay";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import SpecSheetButton, { type PdfEntry } from "@/components/trade/SpecSheetButton";
import { useDesigner, useDesignerByName, useDesignerPicks, useGroupedDesignerPicks } from "@/hooks/useDesigner";
import type { AttributedCuratorPick } from "@/hooks/useDesigner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import ShareMenu from "@/components/ShareMenu";
import WhatsAppShareButton from "@/components/WhatsAppShareButton";
import { shareProfileOnWhatsApp, sharePageOnWhatsApp, buildDesignerOgUrl } from "@/lib/whatsapp-share";
import EditorialBiography, { renderParagraph } from "@/components/EditorialBiography";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PublicProductLightbox, { type PublicLightboxItem } from "@/components/PublicProductLightbox";
import HeritageSlider from "@/components/HeritageSlider";
import { useHeritageSlides } from "@/hooks/useHeritageSlides";
import DesignerInstagramSection from "@/components/DesignerInstagramSection";
import { useDesignerInstagramPosts } from "@/hooks/useDesignerInstagramPosts";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import { isChildBrandDesigner, isParentBrandDesigner } from "@/lib/designerHierarchy";

const transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };
const reveal = { ...transition, delay: 0.15 };
const APPARATUS_SHARE_BRIDGE = "/apparatus-studio-share-v6.html";

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

function ProfileCollapsible({ children, shouldCollapse }: { children: React.ReactNode; shouldCollapse: boolean }) {
  const [sp] = useSearchParams();
  const [expanded, setExpanded] = useState(() => sp.get("expanded") === "true");
  if (!shouldCollapse) return <>{children}</>;
  return (
    <div className="relative">
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {!expanded && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background font-display text-[12px] tracking-[0.18em] uppercase rounded-full hover:bg-foreground/85 transition-colors shadow-md"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            View full profile
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

const PublicDesignerProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const fromJournal = searchParams.get("from_journal"); // e.g. slug of referring article
  const fromNewIn = searchParams.get("from") === "new-in";
  const { data: designer, isLoading } = useDesigner(slug);
  const isParentBrand = isParentBrandDesigner(designer);
  const isChildDesigner = isChildBrandDesigner(designer);
  const { data: parentDesigner } = useDesignerByName(isChildDesigner ? designer?.founder : undefined);
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

  const { data: groupedPicks = [] } = useGroupedDesignerPicks(
    isParentBrand ? designer : undefined,
    { publicOnly: true }
  );
  const { data: ownPicks = [] } = useDesignerPicks(designer?.id, { publicOnly: true });
  const { data: heritageSlides = [] } = useHeritageSlides(designer?.id);
  const { data: instagramPosts = [] } = useDesignerInstagramPosts(designer?.id);
  const isGrouped = isParentBrand && groupedPicks.length > 0;
  const rawPicks = isGrouped ? groupedPicks : ownPicks;
  const displayBiography = isChildDesigner && !designer?.biography && parentDesigner?.biography
    ? parentDesigner.biography
    : designer?.biography;
  const displayBiographyImages = isChildDesigner && (!designer?.biography_images || designer.biography_images.length === 0) && parentDesigner?.biography_images?.length
    ? parentDesigner.biography_images
    : designer?.biography_images;
  const displayPhilosophy = isChildDesigner && !designer?.philosophy && parentDesigner?.philosophy
    ? parentDesigner.philosophy
    : designer?.philosophy;

  const picks = useMemo(() => {
    const columns = isMobile ? Math.max(2, gridCols - 1) : gridCols;

    const keepOuranosOffFirstRow = (items: typeof rawPicks) => {
      if (designer?.slug !== "christopher-boots" || items.length <= columns) return items;
      const idx = items.findIndex((pick) => /^ouranos i$/i.test((pick.title || "").trim()));
      if (idx === -1 || idx >= columns) return items;
      const next = [...items];
      const [ouranos] = next.splice(idx, 1);
      next.push(ouranos);
      return next;
    };

    // Collect image URLs used in biography so matching picks are excluded from the grid.
    const bioUrls = new Set<string>();
    for (const entry of displayBiographyImages || []) {
      if (entry) {
        const url = entry.split(/\s*\|\s*/)[0]?.trim();
        if (url) bioUrls.add(url);
      }
    }
    if (displayBiography) {
      for (const block of displayBiography.split(/\n\n+/)) {
        const trimmed = block.trim();
        const url = trimmed.split(/\s*\|\s*/)[0]?.trim();
        if (url && /^https?:\/\//i.test(url) && !/\s/.test(url)) {
          bioUrls.add(url);
        }
      }
    }

    // Exclude picks whose image already appears in the biography
    const filtered = bioUrls.size > 0 && !isGrouped
      ? rawPicks.filter((pick) => !bioUrls.has(pick.image_url))
      : rawPicks;

    const stabilizedFiltered = keepOuranosOffFirstRow(filtered);
    if (stabilizedFiltered.length <= 2) return stabilizedFiltered;

    const getFunctionalCategory = (pick: (typeof rawPicks)[number]) => {
      if (pick.category?.trim()) return pick.category.trim().toLowerCase();
      if (pick.subcategory?.trim()) return pick.subcategory.trim().toLowerCase();
      return "other";
    };

    const buckets = new Map<string, typeof rawPicks>();
    for (const pick of stabilizedFiltered) {
      const key = getFunctionalCategory(pick);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(pick);
    }

    const queues = [...buckets.entries()].map(([category, items]) => ({
      category,
      items: [...items],
    }));

    const arranged: typeof rawPicks = [];
    while (arranged.length < stabilizedFiltered.length) {
      const index = arranged.length;
      // Block the category directly above AND directly to the left
      const blockedCategories = new Set<string>();
      if (index >= columns) blockedCategories.add(getFunctionalCategory(arranged[index - columns]));
      if (index % columns !== 0 && index > 0) blockedCategories.add(getFunctionalCategory(arranged[index - 1]));

      const candidates = queues
        .filter((q) => q.items.length > 0 && !blockedCategories.has(q.category))
        .sort((a, b) => b.items.length - a.items.length);

      const fallback = queues
        .filter((q) => q.items.length > 0)
        .sort((a, b) => b.items.length - a.items.length)[0];

      const selected = candidates[0] ?? fallback;
      if (!selected) break;

      arranged.push(selected.items.shift()!);
    }

    return keepOuranosOffFirstRow(arranged.length === stabilizedFiltered.length ? arranged : stabilizedFiltered);
  }, [rawPicks, gridCols, isMobile, displayBiographyImages, displayBiography, designer?.slug, isGrouped]);

  const isDesignerProfile = isChildDesigner;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!designer) {
    return <Navigate to="/" replace />;
  }

  const name = displayName(designer.name);
  const profileBadgeLabel = designer.display_name || designer.name;
  const instagramLink = designer.links.find((l) => l.type === "Instagram")?.url;
  const websiteLink = designer.links.find((l) => l.type === "Website")?.url;
  const heroImage = designer.hero_image_url || designer.image_url;
  const designerOgUrl = buildDesignerOgUrl(designer.name);

  const buildDesignerBridgePath = (_kind: "og" | "card") => {
    // Extract path portion from the full URL for sharePageOnWhatsApp's directUrlPath
    return new URL(designerOgUrl).pathname;
  };

  /* Split biography into hero paragraphs + remaining (with interleaved media) — same as trade */
  const bioBlocks = displayBiography
    ? displayBiography.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean)
    : [];
  // Check if biography text already contains inline media URLs
  const bioHasInlineMedia = bioBlocks.some((b: string) => {
    const pipes = b.split(/\s*\|\s*/);
    const url = pipes[0]?.trim() || "";
    if (!/^https?:\/\//i.test(url) || /\s/.test(url)) return false;
    return (
      /\.(avif|gif|jpe?g|png|webp|mp4|webm|mov)(\?|$)/i.test(url) ||
      /res\.cloudinary\.com\/.+\/(image|video)\/upload/i.test(url) ||
      /vimeo\.com\//i.test(url) ||
      /youtube\.com\/watch|youtu\.be\//i.test(url)
    );
  });
  // Skip biography_images interleaving when bio text already has inline media
  const manualMedia = bioHasInlineMedia ? [] : (displayBiographyImages || []).filter(Boolean);
  const mediaEntries = manualMedia.slice(0, 3);

  let heroParagraphs: string[] = [];
  let remainingBio = "";

  // Helper: detect standalone media URLs (images, videos, Vimeo, YouTube, iframe embeds)
  const isMediaBlock = (text: string): boolean => {
    const trimmed = text.trim();
    if (/^<iframe[\s\S]*facebook\.com\/plugins\/video/i.test(trimmed)) return true;

    const pipes = trimmed.split(/\s*\|\s*/);
    const url = pipes[0]?.trim() || "";
    if (!/^https?:\/\//i.test(url)) return false;
    if (/\s/.test(url)) return false;
    return (
      /\.(avif|gif|jpe?g|png|webp|mp4|webm|mov)(\?|$)/i.test(url) ||
      /res\.cloudinary\.com\/.+\/(image|video)\/upload/i.test(url) ||
      /vimeo\.com\//i.test(url) ||
      /youtube\.com\/watch|youtu\.be\/|youtube\.com\/embed/i.test(url) ||
      /facebook\.com\/plugins\/video/i.test(url)
    );
  };

  const isVideoBlock = (text: string): boolean => {
    const trimmed = text.trim();
    if (/^<iframe[\s\S]*(youtube\.com|youtu\.be|vimeo\.com|facebook\.com\/plugins\/video)/i.test(trimmed)) return true;

    const url = trimmed.split(/\s*\|\s*/)[0]?.trim() || "";
    if (!/^https?:\/\//i.test(url) || /\s/.test(url)) return false;

    return (
      /\.(mp4|webm|mov)(\?|$)/i.test(url) ||
      /res\.cloudinary\.com\/.+\/video\/upload/i.test(url) ||
      /vimeo\.com\//i.test(url) ||
      /youtube\.com\/watch|youtu\.be\/|youtube\.com\/embed/i.test(url) ||
      /facebook\.com\/plugins\/video|facebook\.com\/.+\/videos\//i.test(url)
    );
  };

  if (bioBlocks.length > 0) {
    if (mediaEntries.length > 0) {
      // Separate text-only blocks from inline media blocks
      const textBlocks = bioBlocks.filter((b) => !isMediaBlock(b));

      const maxHero = bioHasInlineMedia
        ? 1
        : isMobile
          ? 1
          : (isDesignerProfile ? 3 : 2);
      const chunkCount = mediaEntries.length + 1;
      const chunkSize = Math.max(1, Math.ceil(textBlocks.length / chunkCount));
      const paragraphChunks = Array.from({ length: chunkCount }, (_, i) =>
        textBlocks.slice(i * chunkSize, (i + 1) * chunkSize)
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
      const rawHero = paragraphChunks[0] || [];
      if (rawHero.length > maxHero) {
        const overflow = rawHero.splice(maxHero);
        if (!paragraphChunks[1]) paragraphChunks[1] = [];
        paragraphChunks[1].unshift(...overflow);
      }
      heroParagraphs = rawHero;

      // Build remainingBio preserving original order of inline media blocks.
      // First, reconstruct the remaining blocks in original order (skipping hero paragraphs).
      const heroSet = new Set(heroParagraphs);
      const remainingOrdered: string[] = [];
      for (const block of bioBlocks) {
        if (heroSet.has(block)) {
          heroSet.delete(block);
          continue;
        }
        remainingOrdered.push(block);
      }

      // Now interleave mediaEntries with the remaining ordered blocks:
      // Insert each mediaEntry before its corresponding text chunk boundary.
      const result: string[] = [];
      let textCount = 0;
      let mediaIdx = 0;
      for (const block of remainingOrdered) {
        if (!isMediaBlock(block)) {
          // Check if we should insert a mediaEntry before this text chunk
          const chunkBoundary = mediaIdx < mediaEntries.length
            ? (paragraphChunks[mediaIdx + 1] || [])[0]
            : null;
          if (chunkBoundary && block === chunkBoundary && mediaIdx < mediaEntries.length) {
            result.push(mediaEntries[mediaIdx]);
            mediaIdx++;
          }
        }
        result.push(block);
      }
      // Append any remaining media entries not yet inserted
      while (mediaIdx < mediaEntries.length) {
        result.push(mediaEntries[mediaIdx]);
        mediaIdx++;
      }
      remainingBio = result.filter(Boolean).join("\n\n");
    } else {
      const textBlocks = bioBlocks.filter((b) => !isMediaBlock(b));
      const heroTextCount = bioHasInlineMedia
        ? 1
        : isMobile
          ? 1
          : (isDesignerProfile ? 3 : 2);
      heroParagraphs = textBlocks.slice(0, heroTextCount);
      // Preserve original order including inline media
      const heroSet = new Set(heroParagraphs);
      const allRemaining: string[] = [];
      for (const block of bioBlocks) {
        if (heroSet.has(block)) {
          heroSet.delete(block);
          continue;
        }
        allRemaining.push(block);
      }
      remainingBio = allRemaining.join("\n\n");
    }
  }

  const remainingBlocks = remainingBio
    ? remainingBio.split(/\n\n+/).map((b: string) => b.trim()).filter(Boolean)
    : [];
  const startsWithInlineImage =
    bioHasInlineMedia &&
    heroParagraphs.length > 0 &&
    remainingBlocks.length > 0 &&
    isMediaBlock(remainingBlocks[0]) &&
    !isVideoBlock(remainingBlocks[0]);
  const introEditorialBio = startsWithInlineImage
    ? [remainingBlocks[0], ...heroParagraphs].join("\n\n")
    : "";
  const editorialBlocks = startsWithInlineImage ? remainingBlocks.slice(1) : remainingBlocks;
  const editorialBio = editorialBlocks.join("\n\n");
  const editorialStartImageIndex = startsWithInlineImage ? 1 : 0;

  const biographySection = displayBiography ? (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transition, delay: 0.2 }}
      className="flex flex-col mt-4"
    >
      {displayPhilosophy && (() => {
        const clean = displayPhilosophy.replace(/<[^>]+>/g, '').replace(/^[\s""\u201C\u201D«»]+|[\s""\u201C\u201D«»]+$/g, '').trim();
        const match = clean.match(/^(.*?)\s*\(([^)]+)\)\s*(.*)$/s);
        if (match) {
          return (
            <blockquote className="font-display italic leading-snug mb-6 text-center [text-wrap:pretty]">
              <span className="text-lg md:text-xl text-foreground whitespace-pre-line font-semibold">"{match[1].trimEnd().replace(/^[\s""\u201C\u201D«»]+|[\s""\u201C\u201D«»]+$/g, '')}"</span>
              {match[3] && <span className="text-lg md:text-xl text-foreground whitespace-pre-line font-semibold"> {match[3]}</span>}
              <br />
              <span className="text-sm md:text-base text-muted-foreground/60 font-normal not-italic">{match[2]}</span>
            </blockquote>
          );
        }
        // Try em-dash or hyphen attribution: "quote text — Author" or "quote text\n- Author"
        const dashMatch = clean.match(/^([\s\S]*?)\s*(?:—\s*|-\s*)(.+)$/);
        if (dashMatch) {
          const quoteBody = dashMatch[1].trim().replace(/^[\s""\u201C\u201D«»]+|[\s""\u201C\u201D«»]+$/g, '');
          const attribution = dashMatch[2].trim();
          return (
            <blockquote className="font-display italic leading-snug mb-6 text-center [text-wrap:pretty]">
              <span className="text-lg md:text-xl text-foreground whitespace-pre-line font-semibold">"{quoteBody}"</span>
              <br />
              <span className="text-sm md:text-base text-muted-foreground/60 not-italic mt-2 block font-normal">— {attribution}</span>
            </blockquote>
          );
        }
        return (
          <blockquote className="font-display text-lg md:text-xl italic leading-snug text-foreground mb-6 text-center whitespace-pre-line font-semibold [text-wrap:pretty]">
            "{clean}"
          </blockquote>
        );
      })()}

      {(() => {
        return (
          <>
            <div className="mt-4">
                <h2 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">About</h2>
                {introEditorialBio ? (
                  <EditorialBiography
                    biography={introEditorialBio}
                    biographyImages={[]}
                    pickImages={[]}
                    designerName={designer.name}
                    allowCollapse={false}
                    startImageIndex={0}
                  />
                ) : (
                  <div className="font-body text-sm md:text-[15px] leading-relaxed md:leading-[1.8] text-foreground/85">
                    {heroParagraphs.map((p: string, i: number) => (
                      <p key={i} className={i > 0 ? "mt-4" : ""}>{renderParagraph(p)}</p>
                    ))}
                  </div>
                )}
            </div>

            {heritageSlides.length > 0 && (
              <HeritageSlider slides={heritageSlides} />
            )}

            {editorialBio && (() => {
              const shouldCollapse = editorialBlocks.length > 3;
              return (
                <ProfileCollapsible shouldCollapse={shouldCollapse}>
                  <div className="mt-8 md:mt-10">
                    <EditorialBiography
                      biography={editorialBio}
                      biographyImages={[]}
                      pickImages={[]}
                      designerName={designer.name}
                      allowCollapse={false}
                      startImageIndex={editorialStartImageIndex}
                    />
                  </div>
                </ProfileCollapsible>
              );
            })()}
          </>
        );
      })()}
    </motion.div>
  ) : null;

  return (
    <>
      <Helmet>
        <title>{name} — Maison Affluency</title>
        <meta name="description" content={displayBiography?.slice(0, 155) || designer.specialty} />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        <div className="max-w-6xl mx-auto px-4 md:px-12 pt-32 md:pt-36 pb-20 space-y-1 md:space-y-1.5">
          <div className="flex items-center justify-between">
            {fromJournal ? (
              <Link
                to={`/journal/${fromJournal}`}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-body text-[11px] uppercase tracking-[0.15em]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Article
              </Link>
            ) : (
              <Link
                to={fromNewIn
                  ? `/new-in?designer=${slug}`
                  : (() => {
                      const isChild = designer?.founder && designer.founder !== designer.name;
                      const baseName = isChild ? designer.founder : designer?.name;
                      const letter = encodeURIComponent(baseName?.[0]?.toUpperCase() || "A");
                      const expandParam = isChild ? `&expand=${encodeURIComponent(designer.founder)}` : "";
                      return `/designers?letter=${letter}${expandParam}`;
                    })()}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-body text-[11px] uppercase tracking-[0.15em]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {fromNewIn ? "New In" : "Designers"}
              </Link>
            )}
          </div>

          {isDesignerProfile ? (
            /* Designer profile: portrait hero, then the same editorial biography flow as the parent */
            <div className="flex flex-col gap-0">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={transition}
                className="relative mx-auto w-full max-w-[720px] rounded-xl overflow-hidden shrink-0"
              >
                <div className="aspect-[4/5] md:aspect-[3/4] max-h-[78vh]">
                  {heroImage && (
                    <img
                      src={heroImage}
                      alt={name}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ objectPosition: "center top" }}
                      loading="eager"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                  {/* Mobile share icon inside hero */}
                  <div className="absolute top-3 right-3 z-20 md:hidden">
                    <ShareMenu
                      url={designerOgUrl}
                      message={`${designer.name} — Maison Affluency: ${designerOgUrl}`}
                      className="flex items-center justify-center w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white/90 hover:bg-black/60 transition-colors"
                      iconSize="w-4 h-4"
                      showLabel={false}
                    />
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6 flex items-end justify-between gap-4">
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
                      const url = designerOgUrl;
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

                {designer.hero_photo_credit && (
                  <p className="absolute bottom-1 right-4 md:right-6 text-[10px] uppercase tracking-[0.15em] text-white/50 z-10">
                    Photo: {designer.hero_photo_credit}
                  </p>
                )}
              </motion.div>

              {biographySection}
            </div>
          ) : (
            /* Atelier profile: panoramic hero + bio below */
            <div className="flex flex-col gap-0">
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
                      const url = `https://www.maisonaffluency.com${buildDesignerBridgePath("og")}`;
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
                {designer.hero_photo_credit && (
                  <p className="absolute bottom-1 right-4 md:right-6 text-[10px] uppercase tracking-[0.15em] text-white/50 z-10">
                    Photo: {designer.hero_photo_credit}
                  </p>
                )}
              </motion.div>

              {biographySection}
            </div>
          )}

          <DesignerInstagramSection posts={instagramPosts} designerName={designer?.name || ""} />

          {picks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, delay: 0.25 }}
              className="mt-12 md:mt-16 pt-10 md:pt-14 border-t border-border/40"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="px-4 py-1.5 rounded-full border border-foreground/20 bg-foreground/5">
                    <h2 className="font-display text-[11px] md:text-xs tracking-[0.2em] uppercase text-foreground font-semibold">Curators' Picks</h2>
                  </div>
                </div>
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

              <div className={cn("grid gap-x-3 gap-y-5 md:gap-4 grid-cols-2", gridCols === 4 ? "md:grid-cols-4" : "md:grid-cols-3")}>
                {picks.map((pick) => {
                  const ap = pick as AttributedCuratorPick;
                  const designerLabel = isGrouped && ap.designer_name && ap.designer_name !== designer.name ? ap.designer_name : undefined;
                  const designerSlug = isGrouped && ap.designer_slug ? ap.designer_slug : undefined;
                  const hasMultipleSizes = !!pick.dimensions && pick.dimensions.includes("\n");

                  return (
                    <div
                      key={pick.id}
                      id={`pick-${pick.id}`}
                      ref={(el) => {
                        if (el && highlightId === pick.id) {
                          el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }}
                      className={cn(
                        "group flex flex-col cursor-pointer transition-all duration-700",
                        highlightId === pick.id && "ring-2 ring-primary rounded-xl ring-offset-2 ring-offset-background animate-pulse"
                      )}
                      onClick={() => setLightboxItem({
                        id: pick.id,
                        title: pick.title,
                        subtitle: pick.subtitle,
                        image_url: pick.image_url,
                        hover_image_url: pick.hover_image_url,
                        brand_name: designerLabel || designer.name,
                        materials: pick.materials,
                        dimensions: pick.dimensions,
                        description: pick.description,
                        category: pick.category,
                        subcategory: pick.subcategory,
                        pdf_url: pick.pdf_url || ((pick.pdf_urls as any[] | null)?.[0]?.url ?? undefined),
                        pdf_urls: pick.pdf_urls as PdfEntry[] | undefined,
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
                        {pick.hover_image_url && (
                          <>
                            <img
                              src={responsiveCloudinaryUrl(pick.hover_image_url, 600)}
                              srcSet={pickSrcSet(pick.hover_image_url)}
                              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
                              alt={`${pick.title} alternate finish`}
                              className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                              style={(() => { const t = pick.tags?.find((t) => t.startsWith("hover-pos:")); return t ? { objectPosition: t.replace("hover-pos:", "") } : undefined; })()}
                              loading="lazy"
                            />
                          </>
                        )}
                        {(() => {
                          const tags: string[] = pick.tags || [];
                          // When a specific edition string exists, drop the generic "limited-edition" tag
                          const filtered = pick.edition
                            ? tags.filter(t => !/^limited-edition$/i.test(t))
                            : tags;
                          const specialTags = filtered.filter((t) =>
                            /couture|edition|limited|re-edition|unique|modern scholar|unesco|good design award|genesis collection/i.test(t)
                          );
                          if (pick.edition && !specialTags.some(t => t.toLowerCase() === pick.edition!.toLowerCase())) {
                            specialTags.unshift(pick.edition);
                          }
                          return specialTags.length > 0 ? (
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
                          ) : null;
                        })()}
                        <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="p-1.5 bg-black/40 rounded-md text-white/90 backdrop-blur-sm">
                            <Maximize2 className="h-3 w-3" />
                          </div>
                        </div>
                        <ProductCardDescriptionOverlay description={pick.description} />
                        {(pick.pdf_url || (pick.pdf_urls && (pick.pdf_urls as any[]).length > 0)) && (
                          <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <SpecSheetButton
                              pdfUrl={pick.pdf_url}
                              pdfUrls={pick.pdf_urls as PdfEntry[]}
                              brandName={designer.name}
                              productName={pick.title}
                              className="p-2 bg-[hsl(var(--pdf-red))]/80 rounded-md text-white hover:bg-[hsl(var(--pdf-red))] transition-colors"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col flex-1">
                        <h3 className="font-display text-[11px] md:text-xs tracking-wide leading-snug">{pick.title}</h3>
                        {designerLabel && designerSlug ? (
                          <Link
                            to={`/designers/${designerSlug}`}
                            onClick={(e) => e.stopPropagation()}
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

        </div>

        <div className="text-center py-8">
          <p className="font-body text-sm text-muted-foreground mb-4">Interested in pieces from this collection?</p>
          <Link
            to="/trade-program"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background font-display text-xs tracking-[0.15em] uppercase rounded-full hover:bg-foreground/90 transition-colors"
          >
            Join Our Trade Program
          </Link>
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
          description: p.description,
          category: p.category,
          subcategory: p.subcategory,
          pdf_url: p.pdf_url || ((p.pdf_urls as any[] | null)?.[0]?.url ?? undefined),
          pdf_urls: p.pdf_urls as PdfEntry[] | undefined,
        }))}
        onClose={() => setLightboxItem(null)}
        onSelectRelated={(item) => setLightboxItem(item)}
      />
    </>
  );
};

export default PublicDesignerProfile;
