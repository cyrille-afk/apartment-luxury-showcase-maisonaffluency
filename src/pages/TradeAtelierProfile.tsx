import { useMemo, useEffect, useState, useCallback } from "react";
import HeritageSlider from "@/components/HeritageSlider";
import { useHeritageSlides } from "@/hooks/useHeritageSlides";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowLeft, Instagram, ExternalLink, Quote, Package, FileText, ShoppingCart, Check, Scale, Heart, Loader2, Maximize2, Tag } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import SpecSheetButton from "@/components/trade/SpecSheetButton";
import ProductCardDescriptionOverlay from "@/components/ui/ProductCardDescriptionOverlay";
import EditorialBiography, { renderParagraph } from "@/components/EditorialBiography";
import { cn } from "@/lib/utils";
import { useDesigner, useDesignerPicks, useRelatedDesigners, useGroupedDesignerPicks } from "@/hooks/useDesigner";
import type { AttributedCuratorPick } from "@/hooks/useDesigner";
import { useAuth } from "@/hooks/useAuth";
import { useTradeProducts } from "@/hooks/useTradeProducts";
import WhatsAppShareButton from "@/components/WhatsAppShareButton";
import { sharePageOnWhatsApp } from "@/lib/whatsapp-share";
import CurrencyToggle, { DisplayCurrency, useFxRates, formatPriceConverted } from "@/components/trade/CurrencyToggle";
import TradeProductLightbox, { type TradeProductLightboxItem } from "@/components/trade/TradeProductLightbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import type { DesignerCuratorPick } from "@/hooks/useDesigner";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";

/** Replace a Cloudinary URL's width transform for responsive loading */
function responsiveCloudinaryUrl(url: string, width: number): string {
  if (!url.includes("res.cloudinary.com")) return url;
  const replaced = url.replace(/w_\d+/, `w_${width}`);
  if (replaced !== url) return replaced;
  return url.replace("/upload/", `/upload/w_${width},c_fill,q_auto,f_auto/`);
}

function pickSrcSet(url: string): string {
  return [300, 400, 600, 800].map(w => `${responsiveCloudinaryUrl(url, w)} ${w}w`).join(", ");
}

const transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };
const reveal = { ...transition, delay: 0.15 };

/** Known life dates for historical designers */
const DESIGNER_DATES: Record<string, string> = {
  "jean-michel-frank": "1895–1941",
  "eileen-gray": "1878–1976",
  "pierre-chareau": "1883–1950",
  "robert-mallet-stevens": "1886–1945",
  "mariano-fortuny": "1871–1949",
  "paul-laszlo": "1900–1993",
  "jacques-henri-lartigue": "1894–1986",
  "felix-aublet": "1903–1978",
  "laurent-maugoust-cecile-chenais": "b. 1975",
};

function displayName(name: string): string {
  if (name.includes(" - ")) {
    const [brand, ...rest] = name.split(" - ");
    return `${brand.trim()} — ${rest.join(" - ").trim()}`;
  }
  return name;
}

function pickToLightboxItem(
  pick: DesignerCuratorPick,
  brandName: string,
  displayCurrency?: DisplayCurrency,
  fxRates?: Record<string, number>,
  showTradeDiscount?: boolean,
  discountPct: number = 0.08,
): TradeProductLightboxItem {
  const currency = pick.currency || "EUR";
  let price: string | undefined;
  if (pick.trade_price_cents != null) {
    const cents = showTradeDiscount ? Math.round(pick.trade_price_cents * (1 - discountPct)) : pick.trade_price_cents;
    if (displayCurrency && fxRates) {
      price = formatPriceConverted(cents, currency, displayCurrency, fxRates);
    } else {
      const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency + " ";
      price = `${symbol}${(cents / 100).toLocaleString()}`;
    }
  }
  return {
    id: pick.id,
    product_name: pick.title,
    subtitle: pick.subtitle || undefined,
    image_url: pick.image_url,
    hover_image_url: pick.hover_image_url || undefined,
    brand_name: brandName,
    materials: pick.materials,
    dimensions: pick.dimensions,
    description: pick.description,
    category: pick.category || undefined,
    subcategory: pick.subcategory || undefined,
    pdf_url: pick.pdf_url || ((pick.pdf_urls as any[] | null)?.[0]?.url ?? undefined),
    price,
  };
}

const TradeAtelierProfile = () => {
  const { isTradeUser, isAdmin, user } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromProduct = searchParams.get("from_product");
  const { toast } = useToast();
  const { data: designer, isLoading } = useDesigner(slug);
  const { isPinned, togglePin } = useCompare();

  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetScroll();
    const raf = window.requestAnimationFrame(resetScroll);
    const timer = window.setTimeout(resetScroll, 80);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [slug]);
  // For parent brands (founder === name) or child designers, fetch picks from all related designers
  const isParentBrand = !!(designer?.founder && designer.founder === designer.name);
  const isChildDesigner = !!(designer?.founder && designer.founder !== designer.name);
  const { data: groupedPicks = [] } = useGroupedDesignerPicks(
    isParentBrand ? designer : undefined
  );
  const { data: ownPicks = [] } = useDesignerPicks(designer?.id);
  const rawPicks = isParentBrand && groupedPicks.length > 0 ? groupedPicks : ownPicks;
  const { data: heritageSlides = [] } = useHeritageSlides(designer?.id);

  // Extract image URLs used in biography to deprioritize matching picks
  const bioImageUrls = useMemo(() => {
    const urls = new Set<string>();
    for (const entry of designer?.biography_images || []) {
      if (entry) {
        const url = entry.split(/\s*\|\s*/)[0]?.trim();
        if (url) urls.add(url);
      }
    }
    if (designer?.biography) {
      for (const block of designer.biography.split(/\n\n+/)) {
        const trimmed = block.trim();
        const url = trimmed.split(/\s*\|\s*/)[0]?.trim();
        if (url && /^https?:\/\//i.test(url) && !/\s/.test(url)) {
          urls.add(url);
        }
      }
    }
    return urls;
  }, [designer?.biography_images, designer?.biography]);

  // Interleave picks so same functional subcategory never appears side-by-side
  const picks = useMemo(() => {
    // Deprioritize picks whose image appears in biography
    const deprioritized = [...rawPicks].sort((a, b) => {
      const aInBio = bioImageUrls.has(a.image_url) ? 1 : 0;
      const bInBio = bioImageUrls.has(b.image_url) ? 1 : 0;
      return aInBio - bInBio;
    });
    if (deprioritized.length <= 2) return deprioritized;

    const getFunctionalCategory = (p: typeof rawPicks[0]) => {
      if (p.category?.trim()) return p.category.trim().toLowerCase();
      if (p.subcategory?.trim()) return p.subcategory.trim().toLowerCase();
      return "other";
    };

    const result: typeof rawPicks = [];
    const remaining = [...deprioritized];
    let lastCat = "";

    while (remaining.length > 0) {
      const idx = remaining.findIndex((p) => getFunctionalCategory(p) !== lastCat);
      const picked = idx >= 0 ? remaining.splice(idx, 1)[0] : remaining.shift()!;
      lastCat = getFunctionalCategory(picked);
      result.push(picked);
    }
    return result;
  }, [rawPicks, bioImageUrls]);
  const { data: related = [] } = useRelatedDesigners(slug, designer?.source);
  const profileBadgeLabel = designer?.display_name || designer?.name;
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("original");
  const [gridCols, setGridCols] = useState<3 | 4>(4);
  const [showTradePrice, setShowTradePrice] = useState(false);
  const { discountPct: TRADE_DISCOUNT, discountLabel, tierLabel } = useTradeDiscount();
  const fxRates = useFxRates();

  // Lightbox state
  const [lightboxProduct, setLightboxProduct] = useState<TradeProductLightboxItem | null>(null);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(new Set());

  // Quote state
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchDraft = async () => {
      const { data } = await supabase
        .from("trade_quotes")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1);
      if (data?.length) setActiveQuoteId(data[0].id);
    };
    fetchDraft();
  }, [user]);

  const handleAddToQuote = useCallback(async (product: TradeProductLightboxItem) => {
    if (!user) return;
    setAddingProductId(product.id);

    let quoteId = activeQuoteId;
    if (!quoteId) {
      const { data, error } = await supabase
        .from("trade_quotes")
        .insert({ user_id: user.id, status: "draft" })
        .select("id")
        .single();
      if (error || !data) {
        toast({ title: "Error creating quote", description: error?.message, variant: "destructive" });
        setAddingProductId(null);
        return;
      }
      quoteId = data.id;
      setActiveQuoteId(quoteId);
    }

    const { error } = await supabase.rpc("add_gallery_product_to_quote", {
      _user_id: user.id,
      _quote_id: quoteId!,
      _product_name: product.product_name,
      _brand_name: product.brand_name,
      _category: product.category || "",
      _image_url: product.image_url || null,
      _dimensions: product.dimensions || null,
      _materials: product.materials || null,
      _quantity: 1,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setAddedProductIds(prev => new Set(prev).add(product.id));
      toast({ title: "Added to quote", description: `${product.product_name} added` });
    }
    setAddingProductId(null);
  }, [user, activeQuoteId, toast]);

  const { allProducts } = useTradeProducts();

  const brandProducts = useMemo(() => {
    if (!designer) return [];
    return allProducts.filter(
      (p) => p.brand_name.toLowerCase() === designer.name.toLowerCase()
    );
  }, [designer, allProducts]);

  const categories = useMemo(() => {
    const set = new Set(brandProducts.map((p) => p.category).filter(Boolean));
    return [...set];
  }, [brandProducts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!designer) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h1 className="text-2xl font-light text-foreground mb-4">Atelier not found</h1>
        <button
          onClick={() => navigate("/trade/designers")}
          className="text-primary underline underline-offset-4 text-sm"
        >
          Back to directory
        </button>
      </div>
    );
  }

  const name = displayName(designer.name);
  const instagramLink = designer.links.find((l) => l.type === "Instagram")?.url;
  const websiteLink = designer.links.find((l) => l.type === "Website")?.url;
  const heroHasEmbeddedName = slug === "ecart";

  return (
    <>
      <Helmet>
        <title>{name} — Ateliers & Partners</title>
      </Helmet>

      <div className="space-y-1">
        {/* Back */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (fromProduct) {
                navigate(fromProduct);
                return;
              }
              const atelierName = designer.founder || designer.name;
              navigate(`/trade/designers?brand=${encodeURIComponent(atelierName)}`);
            }}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {fromProduct ? "Back to product" : (designer.founder ? `Back to ${designer.founder}` : "All Ateliers")}
          </button>
          <WhatsAppShareButton
            onClick={(e) => {
              e.preventDefault();
              sharePageOnWhatsApp(
                `/trade/designers/${slug}`,
                name,
                designer.specialty || undefined,
                { directUrlPath: `/${slug}-og.html` }
              );
            }}
            label="Share on WhatsApp"
            variant="prominent"
          />
        </div>

        {/* Hero + About */}
        {(() => {
          const isDesignerProfile = designer.founder && designer.founder !== designer.name;
          const bioBlocks = designer.biography
            ? designer.biography.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean)
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
          const manualMedia = bioHasInlineMedia ? [] : (designer.biography_images || []).filter(Boolean);
          const curatedMedia = bioHasInlineMedia ? [] : picks.slice(0, 2).map((p) => `${p.image_url} | ${p.title}`);
          const baseMediaEntries = (manualMedia.length > 0 ? manualMedia : curatedMedia).slice(0, 3);
          const maisonDeVerreLine = "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/editorial%2Fmaison-de-verre-chareau.jpg | Maison de Verre, Paris";

          const mediaEntries =
            slug === "pierre-chareau" && baseMediaEntries.length > 0
              ? [...baseMediaEntries.slice(0, baseMediaEntries.length - 1), maisonDeVerreLine]
              : baseMediaEntries;

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

          return isDesignerProfile ? (
            <div className="flex flex-col gap-0">
              {/* Hero row: portrait left + quote & opening text right */}
              <div className="flex flex-col md:flex-row gap-0 md:gap-4 md:items-center items-start">
                {/* Left: portrait with overlaid name */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={transition}
                  className="relative shrink-0 md:w-[38%]"
                >
                  {(designer.hero_image_url || designer.image_url) && (
                    <div className="relative rounded-xl overflow-hidden">
                      <img
                        src={designer.hero_image_url || designer.image_url}
                        alt={name}
                        className="w-full h-auto object-contain"
                        loading="eager"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 md:p-6 flex items-end justify-between">
                        <div>
                          <h1 className="font-display text-xl md:text-2xl tracking-wide text-white drop-shadow-md">
                            {name}
                            {slug && DESIGNER_DATES[slug] && (
                              <span className="font-body text-sm md:text-base text-white/75 ml-2 font-normal">{DESIGNER_DATES[slug]}</span>
                            )}
                          </h1>
                          {designer.specialty && (
                            <p className="font-body text-xs md:text-sm text-white/80 mt-1 tracking-wide">{designer.specialty}</p>
                          )}
                        </div>
                        <WhatsAppShareButton
                          hideOn="mobile"
                          onClick={(e) => {
                            e.stopPropagation();
                            sharePageOnWhatsApp(
                              `/trade/designers/${slug}`,
                              name,
                              designer.specialty || undefined,
                              { directUrlPath: `/${slug}-og.html` }
                            );
                          }}
                          label="Share"
                          size="sm"
                          variant="glass"
                        />
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Right: quote + opening paragraphs */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...transition, delay: 0.15 }}
                  className="flex-1 min-w-0 flex flex-col justify-center"
                >
                  {designer.philosophy && (() => {
                    const clean = designer.philosophy.replace(/<[^>]+>/g, '').replace(/^[\s""\u201C\u201D«»]+|[\s""\u201C\u201D«»]+$/g, '').trim();
                    const attrMatch = clean.match(/^([\s\S]*?)\s*(?:—\s*|-\s*)(.+)$/);
                    if (attrMatch) {
                      return (
                        <blockquote className="font-display italic leading-snug mb-5 [text-wrap:pretty]">
                          <span className="text-base md:text-lg text-foreground whitespace-pre-line font-semibold">"{attrMatch[1].trim().replace(/^[\s""\u201C\u201D«»]+|[\s""\u201C\u201D«»]+$/g, '')}"</span>
                          <br />
                          <span className="text-sm text-muted-foreground/60 not-italic mt-2 block font-normal">— {attrMatch[2].trim()}</span>
                        </blockquote>
                      );
                    }
                    return (
                      <blockquote className="font-display text-base md:text-lg italic leading-snug text-foreground mb-5 whitespace-pre-line font-semibold [text-wrap:pretty]">
                        "{clean}"
                      </blockquote>
                    );
                  })()}
                  {heroParagraphs.length > 0 && (
                    <div className="font-body text-sm leading-relaxed text-foreground/85">
                      {heroParagraphs.map((p: string, i: number) => (
                        <p key={i} className={i > 0 ? "mt-4" : ""}>{renderParagraph(p)}</p>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>

              {heritageSlides.length > 0 && (
                <HeritageSlider slides={heritageSlides} />
              )}

              {/* Remaining biography with exactly two staggered images */}
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
                    startImageIndex={0}
                  />
                </motion.div>
              )}
            </div>
          ) : (
            /* Atelier: full-width hero */
            <div className="flex flex-col gap-0">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={transition}
                className="relative rounded-xl overflow-hidden shrink-0"
              >
                <div className="aspect-[3/2] md:aspect-[2/1] max-h-[50vh]">
                  {(designer.hero_image_url || designer.image_url) && (
                    <img
                      src={designer.hero_image_url || designer.image_url}
                      alt={name}
                      className="absolute inset-0 w-full h-full object-cover object-bottom"
                      loading="eager"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={reveal}>
                    {!heroHasEmbeddedName && (
                      <h1 className="font-display text-2xl md:text-4xl tracking-wide text-white drop-shadow-md">
                        {name}
                      </h1>
                    )}
                    {designer.specialty && (
                      <p className="font-body text-sm md:text-base text-white/80 mt-1.5 font-medium tracking-wide">{designer.specialty}</p>
                    )}
                  </motion.div>
                </div>
              </motion.div>

              {designer.biography && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...transition, delay: 0.2 }}
                  className="flex flex-col mt-4"
                >
                  {designer.philosophy && (() => {
                    const clean = designer.philosophy.replace(/<[^>]+>/g, '').replace(/^[\s""\u201C\u201D«»]+|[\s""\u201C\u201D«»]+$/g, '').trim();
                    const attrMatch = clean.match(/^([\s\S]*?)\s*(?:—\s*|-\s*)(.+)$/);
                    if (attrMatch) {
                      return (
                        <blockquote className="font-display italic leading-snug mb-6 [text-wrap:pretty]">
                          <span className="text-lg md:text-xl text-foreground whitespace-pre-line font-semibold">"{attrMatch[1].trim().replace(/^[\s""\u201C\u201D«»]+|[\s""\u201C\u201D«»]+$/g, '')}"</span>
                          <br />
                          <span className="text-sm text-muted-foreground/60 not-italic mt-2 block font-normal">— {attrMatch[2].trim()}</span>
                        </blockquote>
                      );
                    }
                    return (
                      <blockquote className="font-display text-lg md:text-xl italic leading-snug text-foreground mb-6 whitespace-pre-line font-semibold [text-wrap:pretty]">
                        "{clean}"
                      </blockquote>
                    );
                  })()}
                  <h2 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">
                    About
                  </h2>
                  <EditorialBiography
                    biography={designer.biography}
                    biographyImages={designer.biography_images}
                    pickImages={picks.slice(0, 3).map((p) => `${p.image_url} | ${p.title}`)}
                    designerName={designer.name}
                  />
                  {heritageSlides.length > 0 && (
                    <HeritageSlider slides={heritageSlides} />
                  )}
                </motion.div>
              )}
            </div>
          );
        })()}

        {/* Curator's Picks */}
        {picks.length > 0 && (() => {
          const isGrouped = isParentBrand && groupedPicks.length > 0;

          return (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transition, delay: 0.25 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xs tracking-[0.2em] uppercase text-foreground">
                Curators' Picks
              </h2>
              <div className="flex items-center gap-3">
                <div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setGridCols(gridCols === 3 ? 4 : 3)}
                          className="flex items-center p-1.5 rounded transition-all hover:opacity-70"
                          aria-label={`Switch to ${gridCols === 3 ? 4 : 3} column grid`}
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            {gridCols === 3 ? (
                              <>
                                <rect x="2" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                                <rect x="8.5" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                                <rect x="15" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                                <rect x="21.5" y="3" width="1" height="18" rx="0.5" fill="currentColor" opacity="0.25" />
                              </>
                            ) : (
                              <>
                                <rect x="4" y="3" width="4" height="18" rx="1" fill="currentColor" />
                                <rect x="10" y="3" width="4" height="18" rx="1" fill="currentColor" />
                                <rect x="16" y="3" width="4" height="18" rx="1" fill="currentColor" />
                              </>
                            )}
                          </svg>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {gridCols === 3 ? "Display 4" : "Display 3"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CurrencyToggle value={displayCurrency} onChange={setDisplayCurrency} />
                {(isTradeUser || isAdmin) && (
                  <button
                    onClick={() => setShowTradePrice((v) => !v)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-md border font-body text-xs transition-colors",
                      showTradePrice
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                    title={showTradePrice ? `Showing trade price (–${discountLabel}, ${tierLabel} tier)` : "Showing retail price"}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    {showTradePrice ? "Retail" : "Trade"}
                  </button>
                )}
              </div>
            </div>

                <div className={cn("grid gap-x-3 gap-y-5 md:gap-4", gridCols === 4 ? "grid-cols-3 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3")}>
                  {picks.map((pick) => {
                    const isAdding = addingProductId === pick.id;
                    const isAdded = addedProductIds.has(pick.id);
                    const ap = pick as AttributedCuratorPick;
                    const designerLabel = isGrouped && ap.designer_name && ap.designer_name !== designer.name
                      ? ap.designer_name : undefined;
                    const designerSlug = isGrouped && ap.designer_slug ? ap.designer_slug : undefined;
                    return (
                    <div
                      key={pick.id}
                      className="group cursor-pointer flex flex-col"
                      onClick={() => setLightboxProduct(pickToLightboxItem(pick, designerLabel || designer.name, displayCurrency, fxRates, showTradePrice))}
                    >
                      <div className="aspect-[4/5] bg-muted/20 rounded-lg overflow-hidden mb-2 relative flex items-center justify-center">
                        {/* Tag badges — upper-left */}
                        {(() => {
                          const tags: string[] = pick.tags || [];
                          const filtered = pick.edition
                            ? tags.filter(t => !/^limited-edition$/i.test(t))
                            : tags;
                          const specialTags = filtered.filter(t => /couture|edition|limited|re-edition|unique|modern scholar|unesco|good design award|genesis collection/i.test(t));
                          if (pick.edition && !specialTags.some(t => t.toLowerCase() === pick.edition!.toLowerCase())) {
                            specialTags.unshift(pick.edition);
                          }
                          return specialTags.length > 0 ? (
                            <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1">
                              {specialTags.map((tag, i) => (
                                <span key={i} className="inline-block px-2 py-0.5 text-[9px] uppercase tracking-wider font-body bg-black/50 text-white/90 rounded-full border border-black/20 backdrop-blur-sm">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null;
                        })()}
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
                          const hoverPosTag = pick.tags?.find((t: string) => t.startsWith("hover-pos:"));
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
                        <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="p-1.5 bg-black/40 rounded-md text-white/90 backdrop-blur-sm">
                            <Maximize2 className="h-3 w-3" />
                          </div>
                        </div>
                        <ProductCardDescriptionOverlay description={pick.description} />
                        <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {(isTradeUser || isAdmin) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToQuote(pickToLightboxItem(pick, designerLabel || designer.name, displayCurrency, fxRates, showTradePrice));
                              }}
                              className={cn(
                                "p-2 rounded-md text-white transition-colors",
                                isAdded ? "bg-emerald-600" : "bg-foreground/80 hover:bg-foreground"
                              )}
                              title={isAdded ? "Added to quote" : "Add to quote"}
                            >
                              {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                               isAdded ? <Check className="h-3.5 w-3.5" /> :
                               <ShoppingCart className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          {(pick.pdf_url || (pick.pdf_urls && (pick.pdf_urls as any[]).length > 0)) && (
                            <SpecSheetButton
                              pdfUrl={pick.pdf_url}
                              pdfUrls={pick.pdf_urls as any}
                              brandName={designerLabel || designer.name}
                              productName={pick.title}
                              variant="icon"
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col flex-1">
                        <h3 className="font-display text-[11px] md:text-xs tracking-wide leading-snug">
                          {pick.title}
                        </h3>
                        {designerLabel && designerSlug ? (
                          <Link
                            to={`/trade/designers/${designerSlug}`}
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
                        {/* Subtitle, materials & dimensions hidden on grid — shown in lightbox detail view */}
                        <div className="mt-auto pt-1">
                          <p className="font-display text-sm text-center inline-flex items-center justify-center gap-1.5 flex-wrap w-full">
                            {pick.trade_price_cents != null
                              ? (isTradeUser || isAdmin)
                                ? showTradePrice
                                   ? <>
                                      <span className="line-through text-muted-foreground/60 font-normal text-xs">
                                        {`${(pick as any).price_prefix ? (pick as any).price_prefix + ' ' : ''}${formatPriceConverted(pick.trade_price_cents, pick.currency || 'EUR', displayCurrency, fxRates)}`}
                                      </span>
                                      <span className="text-accent font-semibold">
                                        {`${(pick as any).price_prefix ? (pick as any).price_prefix + ' ' : ''}${formatPriceConverted(Math.round(pick.trade_price_cents * (1 - TRADE_DISCOUNT)), pick.currency || 'EUR', displayCurrency, fxRates)}`}
                                      </span>
                                      <span className="font-body text-[9px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full uppercase tracking-wider">–{discountLabel}</span>
                                    </>
                                  : <span className="text-foreground font-semibold">{`${(pick as any).price_prefix ? (pick as any).price_prefix + ' ' : ''}${formatPriceConverted(pick.trade_price_cents, pick.currency || 'EUR', displayCurrency, fxRates)}`}</span>
                                : "Price on request"
                              : "Price on request"}
                          </p>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
          </motion.div>
          );
        })()}

        {picks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/10 rounded-xl">
            <Package className="w-8 h-8 text-muted-foreground/30 mb-3" />
            <p className="font-body text-sm text-muted-foreground">
              Curators' picks coming soon
            </p>
          </div>
        )}

      </div>

      {/* Product Lightbox */}
      <TradeProductLightbox
        product={lightboxProduct}
        onClose={() => setLightboxProduct(null)}
        onAddToQuote={handleAddToQuote}
        isAdding={!!lightboxProduct && addingProductId === lightboxProduct.id}
        isAdded={!!lightboxProduct && addedProductIds.has(lightboxProduct.id)}
        onSelectRelated={(rp) => setLightboxProduct(rp)}
        allPicks={picks.map(p => pickToLightboxItem(p, designer?.name || "", displayCurrency, fxRates))}
      />
    </>
  );
};

export default TradeAtelierProfile;
