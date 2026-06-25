import { useEffect, useMemo, useState, useRef } from "react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
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
import BiographyPdfButton from "@/components/BiographyPdfButton";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PublicProductLightbox, { type PublicLightboxItem } from "@/components/PublicProductLightbox";
import HeritageSlider from "@/components/HeritageSlider";
import { useHeritageSlides } from "@/hooks/useHeritageSlides";
import DesignerInstagramSection from "@/components/DesignerInstagramSection";
import { useDesignerInstagramPosts } from "@/hooks/useDesignerInstagramPosts";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import { consumeProductBackRef } from "@/lib/designerBackRef";
import { isChildBrandDesigner, isParentBrandDesigner } from "@/lib/designerHierarchy";
import { toOgImage } from "@/lib/ogImage";
import { sortCuratorPicks } from "@/lib/curatorPickSort";

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

// Per-slug overrides for pages where the algorithmic title collides with a
// sibling slug or otherwise fails to describe the page uniquely. Keep each
// override within Google's 40-60 char title band.
const DESIGNER_TITLE_OVERRIDES: Record<string, string> = {
  "christophe-delcourt": "Christophe Delcourt — Sculptural Furniture",
  "christophe-delcourt-cc-tapis": "Christophe Delcourt Rugs for cc-tapis Milan",
  "gaelle-lauriot-prevost": "Lauriot-Prévost & Perrault — Ozone Bronze Lighting",
  "gaelle-lauriot-prevost-dominique-perrault-cc-tapis": "Lauriot-Prévost & Perrault Rugs for cc-tapis Milan",
  "ozone": "Ozone Paris — Bronze Furniture & Lighting Editions",
  "ozone-light": "Ozone Light — Sculptural Bronze Lighting, Paris",
  "yabu-pushelberg": "Yabu Pushelberg — Interiors & Furniture Design",
  "yabu-pushelberg-man-of-parts": "Yabu Pushelberg for Man of Parts — Seating & Tables",
  "atelier-fevrier": "Atelier Février — Hand-Knotted Luxury Rugs from Nepal",
  "garnier-linker": "Garnier & Linker Furniture | Maison Affluency",
  "rowin-atelier": "RoWin Atelier Ceramics | Maison Affluency",
};

// Target Google's display bands: title 40-60 chars, description 140-160 chars.

// Deterministic 0..n-1 index from a slug so each designer gets a stable
// template choice without colliding with siblings.
function slugIndex(slug: string | null | undefined, n: number): number {
  if (!n) return 0;
  const s = (slug || "").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h % n) + n) % n;
}

// Extract the leading product-category keyword from a free-text specialty
// ("Lighting, lacquer, parchment" → "lighting"). Falls back to generic
// "collectible design" when nothing usable is present.
function categoryKeyword(specialty?: string | null): string {
  const raw = (specialty || "").toLowerCase().replace(/[^a-z, &/-]+/g, " ").trim();
  if (!raw) return "collectible design";
  const first = raw.split(/[,/]| and /)[0].trim();
  return first || "collectible design";
}

function designerSeoTitle(
  name: string,
  founder?: string | null,
  isChildDesigner?: boolean,
  slug?: string | null,
  specialty?: string | null,
): string {
  if (slug && DESIGNER_TITLE_OVERRIDES[slug]) return DESIGNER_TITLE_OVERRIDES[slug];
  const cleanName = displayName(name);
  const cleanFounder = founder?.trim();
  const kw = categoryKeyword(specialty);
  const kwTitle = kw.replace(/\b\w/g, (c) => c.toUpperCase());

  // Extract slug tokens not already represented in name/founder so pages like
  // /designers/ozone-light don't collide with /designers/ozone.
  const tokenize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const knownTokens = new Set([
    ...tokenize(cleanName),
    ...(cleanFounder ? tokenize(cleanFounder) : []),
  ]);
  const slugExtras = slug
    ? slug
        .split("-")
        .filter((t) => t && !knownTokens.has(t.toLowerCase()))
        .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
        .join(" ")
    : "";
  const displayedName = slugExtras ? `${cleanName} (${slugExtras})` : cleanName;

  const forCandidates: string[] = [];
  if (
    isChildDesigner &&
    cleanFounder &&
    cleanFounder !== cleanName &&
    !cleanName.toLowerCase().includes(cleanFounder.toLowerCase())
  ) {
    forCandidates.push(
      `${displayedName} for ${cleanFounder} — ${kwTitle} | Maison Affluency`,
      `${displayedName} ${kwTitle} for ${cleanFounder} | Maison Affluency`,
      `${displayedName} for ${cleanFounder} — Designer | Maison Affluency Singapore`,
      `${displayedName} for ${cleanFounder} — Maison Affluency Singapore`,
      `${displayedName} for ${cleanFounder} — Maison Affluency`,
    );
  }
  const soloCandidates: string[] = [
    `${displayedName} — ${kwTitle} | Maison Affluency Singapore`,
    `${displayedName} — Collectible ${kwTitle} | Maison Affluency`,
    `${displayedName} ${kwTitle} & Collectible Design | Maison Affluency`,
    `${displayedName} — Collectible Designer | Maison Affluency Singapore`,
    `${displayedName} — Designer | Maison Affluency Singapore`,
    `${displayedName} — Designer | Maison Affluency`,
    `${displayedName} — Maison Affluency Singapore`,
    `${displayedName} — Maison Affluency`,
  ];

  // Prefer disambiguating "for {founder}" titles when any fit the band; only
  // fall back to solo titles when no for-candidate fits. Within the in-band
  // set, vary the choice per-slug so siblings don't collapse to the same title.
  const pickInBand = (list: string[]) => {
    const inBand = list.filter((c) => c.length >= 40 && c.length <= 60);
    if (!inBand.length) return null;
    return inBand[slugIndex(slug, inBand.length)];
  };
  const fromFor = pickInBand(forCandidates);
  if (fromFor) return fromFor;
  const fromSolo = pickInBand(soloCandidates);
  if (fromSolo) return fromSolo;
  // Last resort: closest-to-50, but still prefer for-candidates when present
  // so child designers don't collapse to the same title as their parent.
  const pool = forCandidates.length ? forCandidates : soloCandidates;
  return pool.sort((a, b) => Math.abs(50 - a.length) - Math.abs(50 - b.length))[0];
}

function designerSeoDescription(args: { name: string; founder?: string | null; specialty?: string | null; biography?: string | null; isChildDesigner?: boolean; slug?: string | null }) {
  const cleanName = displayName(args.name);
  const cleanFounder = args.founder?.trim();
  const rawBio = args.biography ? args.biography.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
  const genericAffiliation = /^designer\s+for\s+.+\.?$/i.test(rawBio);
  const usableBio = rawBio && !genericAffiliation ? rawBio : "";

  // Helper: trim to ≤160 at a word boundary, ending with "…" if cut.
  const clamp160 = (s: string) => {
    const clean = s.replace(/\s+/g, " ").trim();
    if (clean.length <= 160) return clean;
    const cut = clean.slice(0, 159);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:\s]+$/, "") + "…";
  };

  // Rich biography → let it stand alone. The first 160 chars of a real bio
  // are unique per designer, which is exactly what duplicate-description
  // scanners look for. No shared marketing suffix.
  if (usableBio.length >= 140) {
    return clamp160(usableBio);
  }

  // Thin/missing bio → build a per-designer sentence that varies by name,
  // specialty, founder and slug-derived template so siblings don't share
  // descriptions verbatim.
  const specialty = args.specialty?.trim().replace(/\.$/, "");
  const kw = categoryKeyword(specialty);
  const leadOptions = usableBio
    ? [usableBio]
    : specialty
      ? (args.isChildDesigner && cleanFounder
        ? [
            `${cleanName} designs ${specialty.toLowerCase()} for ${cleanFounder}.`,
            `${cleanName} — ${specialty} for ${cleanFounder}.`,
            `${specialty} by ${cleanName} for ${cleanFounder}.`,
          ]
        : [
            `${cleanName} — ${specialty}.`,
            `${cleanName}: collectible ${kw} and limited editions.`,
            `${specialty} by ${cleanName}.`,
          ])
      : [`${cleanName} — collectible ${kw}.`];
  const lead = leadOptions[slugIndex(args.slug, leadOptions.length)];

  const tailOptions = args.isChildDesigner && cleanFounder
    ? [
        ` Collectible pieces curated by Maison Affluency, Singapore.`,
        ` Trade-priced pieces from ${cleanFounder}, presented by Maison Affluency Singapore.`,
        ` Available to architects and designers via Maison Affluency Singapore.`,
      ]
    : [
        ` Collectible furniture, lighting and limited editions — Maison Affluency, Singapore.`,
        ` Curated by Maison Affluency Singapore for trade and private collectors worldwide.`,
        ` Apartment-showroom and trade catalogue — Maison Affluency, Singapore.`,
      ];
  const tail = tailOptions[slugIndex(args.slug, tailOptions.length)];
  return clamp160(`${lead}${tail}`);
}

// Visible fallback paragraph to lift designer pages out of "thin content" when
// the source biography is brief. Rendered only when the user-visible biography
// has fewer than ~60 words; never overrides existing rich biographies.
function buildThinContentFallback(args: {
  name: string;
  founder?: string | null;
  specialty?: string | null;
  isChildDesigner?: boolean;
  slug?: string | null;
}): string {
  const cleanName = displayName(args.name);
  const cleanFounder = args.founder?.trim();
  const specialty = args.specialty?.trim().replace(/\.$/, "");
  const kw = categoryKeyword(specialty);
  const kwPlural = /s$/.test(kw) ? kw : `${kw} pieces`;

  const leads = args.isChildDesigner && cleanFounder
    ? [
        `${cleanName} designs for ${cleanFounder}, a maison championed by Maison Affluency Singapore for its collectible vision.`,
        `${cleanName} authors ${kwPlural} for ${cleanFounder} — a partnership Maison Affluency Singapore presents to interior architects and private collectors.`,
        `Under ${cleanFounder}, ${cleanName} develops ${kw} that Maison Affluency Singapore curates for residential and hospitality projects in Asia and beyond.`,
      ]
    : [
        `${cleanName} is featured by Maison Affluency Singapore for a body of work that resonates with our curatorial vision.`,
        `${cleanName} produces collectible ${kw} that Maison Affluency Singapore offers to designers, architects and private clients worldwide.`,
        `Maison Affluency Singapore represents ${cleanName}, whose ${kw} sits at the intersection of authorship, material research and slow craftsmanship.`,
      ];
  const middles = specialty
    ? [
        `Their practice spans ${specialty.toLowerCase()}, conceived as collectible pieces for interiors that reward attention.`,
        `The studio's vocabulary — ${specialty.toLowerCase()} — is built around limited runs, considered materials and details that age beautifully.`,
        `Each commission interprets ${specialty.toLowerCase()} as collectible design: small editions, signed work, and an unmistakable hand.`,
      ]
    : [
        `Their practice favours collectible pieces — furniture, lighting and decorative objects conceived for interiors that reward attention.`,
        `The studio works in limited editions across furniture, lighting and decorative objects, with material integrity at the centre of every commission.`,
        `Work moves between furniture, lighting and decorative objects, each piece conceived as a collectible rather than a catalogue item.`,
      ];
  const closes = [
    `Each work is selected for material integrity, authorship and the way it ages — qualities we present in person at the Maison Affluency apartment-showroom in Singapore and to trade clients worldwide.`,
    `Maison Affluency offers trade pricing, lead times and full specification on request — meet the work in our Singapore apartment-showroom or via virtual presentation.`,
    `Available to interior designers, architects and private collectors through Maison Affluency Singapore, with white-label documentation and worldwide delivery.`,
  ];
  const i = slugIndex(args.slug, 3);
  return `${leads[i]} ${middles[i]} ${closes[i]}`;
}

function ProfileCollapsible({ children, shouldCollapse }: { children: React.ReactNode; shouldCollapse: boolean }) {
  const [sp] = useSearchParams();
  const [expanded, setExpanded] = useState(() => sp.get("expanded") === "true");
  const panelId = "designer-profile-extra";
  if (!shouldCollapse) return <>{children}</>;
  return (
    <div className="relative">
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="expanded"
            id={panelId}
            role="region"
            aria-label="Full designer profile"
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
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background font-display text-[12px] tracking-[0.18em] uppercase rounded-full hover:bg-foreground/85 transition-colors shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
          >
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            View full profile
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
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
  const scrollToSection = searchParams.get("section");
  const fromJournal = searchParams.get("from_journal"); // e.g. slug of referring article
  const fromNewIn = searchParams.get("from") === "new-in";
  const fromProduct = useMemo(
    () => searchParams.get("from_product") || consumeProductBackRef(slug),
    [searchParams, slug]
  );
  const { data: designer, isLoading } = useDesigner(slug);
  const isParentBrand = isParentBrandDesigner(designer);
  const isChildDesigner = isChildBrandDesigner(designer);
  const { data: parentDesigner } = useDesignerByName(isChildDesigner ? designer?.founder : undefined);
  const [lightboxItem, setLightboxItem] = useState<PublicLightboxItem | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const isMobile = useIsMobile();
  const picksSectionRef = useRef<HTMLDivElement | null>(null);

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
  // Child designers must never inherit biography text, philosophy, or media from
  // the parent brand — parent bios embed inline image/video URLs that would leak.
  const displayBiography = designer?.biography;
  const displayBiographyImages = designer?.biography_images;
  const displayPhilosophy = designer?.philosophy;

  const picks = useMemo(() => {
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

    return sortCuratorPicks(filtered);
  }, [rawPicks, displayBiographyImages, displayBiography, isGrouped]);

  useEffect(() => {
    if (scrollToSection !== "picks" || picks.length === 0) return;

    const timer = window.setTimeout(() => {
      picksSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [scrollToSection, picks.length]);

  const isDesignerProfile = isChildDesigner;
  // Force full-width hero layout for ALL designer profiles (parent or child)
  const useChildHeroLayout = false;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <DotCircleLoader size="md" />
      </div>
    );
  }

  if (!designer) {
    return (
      <>
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
          <title>Not found — Maison Affluency</title>
        </Helmet>
        <Navigate to="/" replace />
      </>
    );
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
      /youtube\.com\/watch|youtu\.be\//i.test(url) ||
      /instagram\.com\/(reel|reels|p|tv)\//i.test(url)
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
      /facebook\.com\/plugins\/video/i.test(url) ||
      /instagram\.com\/(reel|reels|p|tv)\//i.test(url)
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
      /facebook\.com\/plugins\/video|facebook\.com\/.+\/videos\//i.test(url) ||
      /instagram\.com\/(reel|reels|p|tv)\//i.test(url)
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
  // Collapsed preview shows ONLY the hero paragraph(s) — no image. This
  // eliminates the large blank space that appeared when a tall image sat
  // beside a short intro paragraph. The first inline image (with its full
  // caption) is moved into editorialBio so it appears as the first element
  // once the user clicks "View full profile".
  const introEditorialBio = "";
  const editorialBlocks = remainingBlocks;
  const editorialBio = editorialBlocks.join("\n\n");
  const editorialStartImageIndex = 0;
  void startsWithInlineImage;

  const bioWordCount = (displayBiography || "").replace(/<[^>]+>/g, " ").replace(/https?:\S+/g, "").trim().split(/\s+/).filter(Boolean).length;
  const showThinContentFallback = bioWordCount < 60;
  const thinContentFallback = showThinContentFallback
    ? buildThinContentFallback({ name: designer.name, founder: designer.founder, specialty: designer.specialty, isChildDesigner })
    : "";

  const biographySection = (displayBiography || thinContentFallback) ? (
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
                <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
                  <h2 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground">About</h2>
                  <BiographyPdfButton
                    designerName={designer.name}
                    specialty={designer.specialty}
                    philosophy={displayPhilosophy}
                    biography={displayBiography || ""}
                    biographyImages={displayBiographyImages}
                    heroImageUrl={heroImage}
                    heroImageFallbackUrl={designer.hero_image_url && designer.image_url && designer.hero_image_url !== designer.image_url ? designer.image_url : null}
                    profileUrl={`https://www.maisonaffluency.com${typeof window !== "undefined" ? window.location.pathname : ""}`}
                  />
                </div>
                {introEditorialBio ? (
                  <EditorialBiography
                    biography={introEditorialBio}
                    biographyImages={[]}
                    pickImages={[]}
                    designerName={designer.name}
                    allowCollapse={false}
                    startImageIndex={0}
                  />
                ) : heroParagraphs.length > 0 ? (
                  <div className="font-body text-sm md:text-[15px] leading-relaxed md:leading-[1.8] text-foreground/85">
                    {heroParagraphs.map((p: string, i: number) => (
                      <p key={i} className={i > 0 ? "mt-4" : ""}>{renderParagraph(p)}</p>
                    ))}
                  </div>
                ) : null}

                {thinContentFallback && (
                  <div className="font-body text-sm md:text-[15px] leading-relaxed md:leading-[1.8] text-foreground/85 mt-4">
                    <p>{thinContentFallback}</p>
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
      {(() => {
        const canonical = `https://maisonaffluency.com/designers/${designer.slug}`;
        const ogImg = toOgImage(designer.hero_image_url || designer.image_url || null);
        const seoTitle = designerSeoTitle(name, designer.founder, isChildDesigner, designer.slug);
        const desc = designerSeoDescription({ name, founder: designer.founder, specialty: designer.specialty, biography: designer.biography, isChildDesigner });
        const personLd = {
          "@context": "https://schema.org",
          "@type": isParentBrand ? "Organization" : "Person",
          name: displayName(name),
          description: desc,
          image: ogImg,
          url: canonical,
          ...(isChildDesigner && designer.founder ? { affiliation: { "@type": "Organization", name: designer.founder } } : {}),
        };
        const crumbsLd = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://maisonaffluency.com" },
            { "@type": "ListItem", position: 2, name: "Designers", item: "https://maisonaffluency.com/designers" },
            { "@type": "ListItem", position: 3, name: displayName(name), item: canonical },
          ],
        };
        return (
          <Helmet>
            <title>{seoTitle}</title>
            <meta name="description" content={desc} />
            <link rel="canonical" href={canonical} />
            <meta property="og:type" content="profile" />
            <meta property="og:site_name" content="Maison Affluency" />
            <meta property="og:title" content={seoTitle} />
            <meta property="og:description" content={desc} />
            <meta property="og:url" content={canonical} />
            <meta property="og:image" content={ogImg} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={displayName(name)} />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={seoTitle} />
            <meta name="twitter:description" content={desc} />
            <meta name="twitter:image" content={ogImg} />
            <script type="application/ld+json">{JSON.stringify(personLd)}</script>
            <script type="application/ld+json">{JSON.stringify(crumbsLd)}</script>
          </Helmet>
        );
      })()}

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        <div className="max-w-6xl mx-auto px-4 md:px-12 pt-32 md:pt-36 pb-20 space-y-1 md:space-y-1.5">
          <div className="flex items-center justify-between">
            {fromProduct ? (
              <Link
                to={fromProduct}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-body text-[11px] uppercase tracking-[0.15em]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Product
              </Link>
            ) : fromJournal ? (
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

          {useChildHeroLayout ? (
            /* Designer profile: portrait hero, then the same editorial biography flow as the parent */
            <div className="flex flex-col gap-0">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={transition}
                className="relative mx-auto w-full max-w-[720px] rounded-xl overflow-hidden shrink-0"
              >
                <div className="aspect-[4/3] sm:aspect-[3/2] md:aspect-[16/10] lg:aspect-[16/9] max-h-[75vh]">
                  {heroImage && (
                    <img
                      src={heroImage}
                      alt={name}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ objectPosition: "center bottom" }}
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
                  {/* Mobile share icon inside hero */}
                  <div className="absolute top-3 right-3 z-20 md:hidden">
                    <ShareMenu
                      url={`https://www.maisonaffluency.com${buildDesignerBridgePath("og")}`}
                      message={`${designer.name} — Maison Affluency: https://www.maisonaffluency.com${buildDesignerBridgePath("og")}`}
                      className="flex items-center justify-center w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white/90 hover:bg-black/60 transition-colors"
                      iconSize="w-4 h-4"
                      showLabel={false}
                    />
                  </div>
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
              id="curators-picks"
              ref={picksSectionRef}
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
              </div>

              {(() => {
                 const forceTwoCol = designer.slug === "adrien-messie";
                 const gridClass = forceTwoCol
                   ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-2"
                   : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
                 return (
              <div className={cn("grid gap-x-3 gap-y-5 md:gap-4", gridClass)}>

                {picks.map((pick) => {
                  const ap = pick as AttributedCuratorPick;
                  const designerLabel = isGrouped && ap.designer_name && ap.designer_name !== designer.name ? ap.designer_name : undefined;
                  const designerSlug = isGrouped && ap.designer_slug ? ap.designer_slug : undefined;
                  const hasMultipleSizes = !!pick.dimensions && pick.dimensions.includes("\n");
                  // Parent brand attribution: show on every child-designer card when a parent designer page exists
                  const showParentBrand =
                    !designerLabel &&
                    isChildDesigner &&
                    !!designer.founder &&
                    !!parentDesigner?.slug;
                  const parentBrandName = showParentBrand ? designer.founder! : undefined;
                  const parentBrandSlug = showParentBrand ? parentDesigner!.slug : undefined;


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
                        materials_description: (pick as any).materials_description ?? null,
                        dimensions: pick.dimensions,
                        lead_time: (pick as any).lead_time ?? null,
                        origin: (pick as any).origin ?? null,
                        description: pick.description,
                        category: pick.category,
                        subcategory: pick.subcategory,
                        pdf_url: pick.pdf_url || ((pick.pdf_urls as any[] | null)?.[0]?.url ?? undefined),
                        pdf_urls: pick.pdf_urls as PdfEntry[] | undefined,
                        designer_slug: designerSlug || designer.slug,
                        size_variants: (pick as any).size_variants ?? null,
                        variant_placeholder: (pick as any).variant_placeholder ?? null,
                        base_axis_label: (pick as any).base_axis_label ?? null,
                        top_axis_label: (pick as any).top_axis_label ?? null,
                        gallery_images: (pick as any).gallery_images ?? null,
                        variant_image_map: (pick as any).variant_image_map ?? null,
                        gallery_captions: (pick as any).gallery_captions ?? null,
                      })}
                    >
                      <div className="aspect-square md:aspect-[4/5] bg-muted/30 rounded-xl overflow-hidden mb-2 md:mb-2 relative flex items-center justify-center">
                        <img
                          src={responsiveCloudinaryUrl(pick.image_url, 600)}
                          srcSet={pickSrcSet(pick.image_url)}
                          sizes="(max-width: 640px) 90vw, (max-width: 768px) 45vw, (max-width: 1024px) 30vw, 25vw"
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
                          sizes="(max-width: 640px) 90vw, (max-width: 768px) 45vw, (max-width: 1024px) 30vw, 25vw"
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
                          let filtered = pick.edition
                            ? tags.filter(t => !/^limited-edition$/i.test(t))
                            : tags;
                          // Avoid duplicating "Re-edition" when the parent-brand badge already says so
                          if (parentBrandName) {
                            filtered = filtered.filter(t => !/re-?edition/i.test(t));
                          }
                          const specialTags = filtered.filter((t) =>
                            /couture|edition|limited|re-edition|unique|modern scholar|unesco|good design award|genesis collection/i.test(t)
                          );
                          if (pick.edition && !parentBrandName && !specialTags.some(t => t.toLowerCase() === pick.edition!.toLowerCase())) {
                            specialTags.unshift(pick.edition);
                          }
                          return specialTags.length > 0 ? (
                            <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end">
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

                        {parentBrandName && (
                          <div className="absolute top-2 right-2">
                            <span className="inline-block px-2 py-0.5 text-[8px] md:text-[9px] uppercase tracking-wider font-body bg-white/85 text-foreground rounded-full border border-black/10 backdrop-blur-sm">
                              Re-edition by {parentBrandName}
                            </span>
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="p-1.5 bg-black/40 rounded-md text-white/90 backdrop-blur-sm">
                            <Maximize2 className="h-3 w-3" />
                          </div>
                        </div>
                        {/* Description overlay removed on curators' picks per design */}
                        {(pick.pdf_url || (pick.pdf_urls as any[] | null)?.length) && (

                          <div className="absolute bottom-2 right-2 hidden md:flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

                      {/* Editorial text block — quiet, uniform, line-clamped */}
                      <div className="flex flex-col flex-1 px-0.5 md:px-0 text-center">
                        {/* Designer / brand label — small caps, muted (mobile only shows when grouped, like competitor) */}
                        {designerLabel && designerSlug ? (
                          <Link
                            to={`/designers/${designerSlug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block font-body text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors leading-tight line-clamp-1"
                          >
                            {designerLabel}
                          </Link>
                        ) : designerLabel ? (
                          <span className="block font-body text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted-foreground leading-tight line-clamp-1">
                            {designerLabel}
                          </span>
                        ) : parentBrandName ? (
                          <Link
                            to={`/designers/${parentBrandSlug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block font-body text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors leading-tight line-clamp-1"
                          >
                            {parentBrandName}
                          </Link>
                        ) : null}


                        {/* Product name — primary */}
                        <h3 className="font-display text-[14px] md:text-sm tracking-wide leading-snug mt-2 line-clamp-2">
                          {pick.title}
                        </h3>

                        {/* Subtitle, materials & dimensions hidden on grid — shown in lightbox detail view */}

                        {/* Price slot — pushed to bottom so cards align across the row */}
                        <div className="mt-2">
                          <p className="font-body text-[10px] md:text-xs text-muted-foreground md:text-foreground tracking-wide">
                            Price upon request
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
                );
              })()}
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
          materials_description: (p as any).materials_description ?? null,
          dimensions: p.dimensions,
          lead_time: (p as any).lead_time ?? null,
          origin: (p as any).origin ?? null,
          description: p.description,
          category: p.category,
          subcategory: p.subcategory,
          pdf_url: p.pdf_url || ((p.pdf_urls as any[] | null)?.[0]?.url ?? undefined),
          pdf_urls: p.pdf_urls as PdfEntry[] | undefined,
          designer_slug: (p as AttributedCuratorPick).designer_slug || designer?.slug || null,
          size_variants: (p as any).size_variants ?? null,
          variant_placeholder: (p as any).variant_placeholder ?? null,
          base_axis_label: (p as any).base_axis_label ?? null,
          top_axis_label: (p as any).top_axis_label ?? null,
          gallery_images: (p as any).gallery_images ?? null,
          variant_image_map: (p as any).variant_image_map ?? null,
        }))}
        onClose={() => setLightboxItem(null)}
        onSelectRelated={(item) => setLightboxItem(item)}
      />
    </>
  );
};

export default PublicDesignerProfile;
