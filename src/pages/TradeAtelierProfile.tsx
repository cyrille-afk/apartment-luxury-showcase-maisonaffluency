import { useMemo, useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowLeft, Instagram, ExternalLink, Quote, Package, FileText, ShoppingCart, Check, Scale, Heart, Loader2 } from "lucide-react";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import EditorialBiography from "@/components/EditorialBiography";
import { cn } from "@/lib/utils";
import { useDesigner, useDesignerPicks, useRelatedDesigners, useGroupedDesignerPicks } from "@/hooks/useDesigner";
import type { AttributedCuratorPick } from "@/hooks/useDesigner";
import { useAuth } from "@/hooks/useAuth";
import { getAllTradeProducts } from "@/lib/tradeProducts";
import WhatsAppShareButton from "@/components/WhatsAppShareButton";
import { sharePageOnWhatsApp } from "@/lib/whatsapp-share";
import { Badge } from "@/components/ui/badge";
import CurrencyToggle, { DisplayCurrency, useFxRates, formatPriceConverted } from "@/components/trade/CurrencyToggle";
import TradeProductLightbox, { type TradeProductLightboxItem } from "@/components/trade/TradeProductLightbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import type { DesignerCuratorPick } from "@/hooks/useDesigner";

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

function pickToLightboxItem(pick: DesignerCuratorPick, brandName: string): TradeProductLightboxItem {
  return {
    id: pick.id,
    product_name: pick.title,
    subtitle: pick.subtitle || undefined,
    image_url: pick.image_url,
    hover_image_url: pick.hover_image_url || undefined,
    brand_name: brandName,
    materials: pick.materials,
    dimensions: pick.dimensions,
    category: pick.category || undefined,
    subcategory: pick.subcategory || undefined,
    pdf_url: pick.pdf_url || ((pick.pdf_urls as any[] | null)?.[0]?.url ?? undefined),
    price: pick.trade_price_cents != null
      ? `€${(pick.trade_price_cents / 100).toLocaleString()}`
      : undefined,
  };
}

const TradeAtelierProfile = () => {
  const { isTradeUser, isAdmin, user } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: designer, isLoading } = useDesigner(slug);
  const { isPinned, togglePin } = useCompare();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [slug]);
  // For parent brands (founder === name), fetch picks from all sub-designers
  const isParentBrand = designer?.founder === designer?.name || (!designer?.founder && designer?.name);
  const { data: groupedPicks = [] } = useGroupedDesignerPicks(
    isParentBrand && designer?.founder === designer?.name ? designer : undefined
  );
  const { data: ownPicks = [] } = useDesignerPicks(designer?.id);
  const picks = groupedPicks.length > 0 ? groupedPicks : ownPicks;
  const { data: related = [] } = useRelatedDesigners(slug, designer?.source);
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("original");
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

  const allProducts = useMemo(() => getAllTradeProducts(), []);

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

      <div className="space-y-4">
        {/* Back */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              const atelierName = designer.founder || designer.name;
              navigate(`/trade/designers?brand=${encodeURIComponent(atelierName)}`);
            }}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {designer.founder ? `Back to ${designer.founder}` : "All Ateliers"}
          </button>
          <WhatsAppShareButton
            onClick={(e) => {
              e.preventDefault();
              sharePageOnWhatsApp(
                `/trade/designers/${slug}`,
                name,
                designer.specialty || undefined,
                { directUrlPath: `/designers/${slug}-share.html` }
              );
            }}
            label="Share on WhatsApp"
            variant="prominent"
          />
        </div>

        {/* Hero + About */}
        {(() => {
          const isDesignerProfile = designer.founder && designer.founder !== designer.name;
          const heroAspect = isDesignerProfile ? "aspect-[3/4]" : "aspect-[3/2]";
          return (
        <div className={cn("flex flex-col gap-6", isDesignerProfile && "md:flex-row")}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={transition}
            className={cn("relative rounded-xl overflow-hidden shrink-0", isDesignerProfile && "md:w-1/2")}
          >
            <div className={heroAspect}>
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
            {designer.founder && designer.founder !== designer.name && (
              <Link
                to={`/trade/designers/${designer.founder.toLowerCase().replace(/\s+/g, '-')}`}
                className="absolute top-4 left-4 md:top-6 md:left-6 z-10 w-16 h-16 md:w-20 md:h-20 bg-black text-white font-display text-[7px] md:text-[9px] tracking-[0.12em] uppercase hover:bg-black/80 transition-colors shadow-lg flex items-center justify-center text-center leading-tight overflow-hidden p-1"
              >
                {designer.founder}
              </Link>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={reveal}>
                {!heroHasEmbeddedName && (
                  <h1 className="font-display text-2xl md:text-4xl tracking-wide text-white drop-shadow-md">
                    {name}
                    {slug && DESIGNER_DATES[slug] && (
                      <span className="font-body text-base md:text-xl text-white/60 ml-3 font-normal">{DESIGNER_DATES[slug]}</span>
                    )}
                  </h1>
                )}
                {designer.specialty && (
                  <p className="font-body text-sm md:text-base text-white/80 mt-1.5 font-medium tracking-wide">{designer.specialty}</p>
                )}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-3">
                    {instagramLink && (
                      <a href={instagramLink} target="_blank" rel="noopener noreferrer"
                        className="text-white/60 hover:text-white transition-colors">
                        <Instagram className="w-4 h-4" />
                      </a>
                    )}
                    {websiteLink && (
                      <a href={websiteLink} target="_blank" rel="noopener noreferrer"
                        className="text-white/60 hover:text-white transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  <WhatsAppShareButton
                    onClick={(e) => {
                      e.preventDefault();
                      sharePageOnWhatsApp(
                        `/trade/designers/${slug}`,
                        name,
                        designer.specialty || undefined,
                        { directUrlPath: `/designers/${slug}-share.html` }
                      );
                    }}
                    label="Share on WhatsApp"
                    variant="glass"
                    size="sm"
                    hideOn="mobile"
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>

          {designer.biography && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, delay: 0.2 }}
              className={cn(isDesignerProfile ? "md:w-1/2 flex flex-col justify-center" : "flex flex-col")}
            >
              {designer.philosophy && (
                <blockquote className="font-display text-lg md:text-xl italic leading-snug text-foreground mb-6">
                  "{designer.philosophy}"
                </blockquote>
              )}
              {!isDesignerProfile && (
                <h2 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">
                  About
                </h2>
              )}
              <EditorialBiography
                biography={designer.biography}
                biographyImages={designer.biography_images}
                pickImages={picks.slice(0, 3).map((p) => p.image_url)}
                designerName={designer.name}
              />
            </motion.div>
          )}
        </div>
          );
        })()}

        {/* Curator's Picks */}
        {picks.length > 0 && (() => {
          const isGrouped = groupedPicks.length > 0;

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
              <CurrencyToggle value={displayCurrency} onChange={setDisplayCurrency} />
            </div>

                <div className="grid grid-cols-3 gap-x-3 gap-y-5 md:grid-cols-4 md:gap-4">
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
                      className="group cursor-pointer"
                      onClick={() => setLightboxProduct(pickToLightboxItem(pick, designerLabel || designer.name))}
                    >
                      <div className="aspect-[4/5] bg-muted/20 rounded-lg overflow-hidden mb-2 relative">
                        <img
                          src={responsiveCloudinaryUrl(pick.image_url, 600)}
                          srcSet={pickSrcSet(pick.image_url)}
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
                          alt={pick.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                        {pick.tags && pick.tags.length > 0 && (
                          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                            {pick.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[8px] md:text-[9px] px-1.5 py-0.5 font-body tracking-wide bg-background/80 backdrop-blur-sm text-foreground border-none shadow-sm">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {(isTradeUser || isAdmin) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToQuote(pickToLightboxItem(pick, designerLabel || designer.name));
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
                          {(pick.pdf_url || (pick.pdf_urls && (pick.pdf_urls as any[]).length > 0)) && (() => {
                            const pdfHref = pick.pdf_url
                              ? buildSpecSheetUrl(pick.pdf_url, designerLabel || designer.name, pick.title)
                              : buildSpecSheetUrl((pick.pdf_urls as any[])[0].url, designerLabel || designer.name, pick.title);
                            return (
                              <a
                                href={pdfHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 bg-[hsl(var(--pdf-red))]/80 rounded-md text-white hover:bg-[hsl(var(--pdf-red))] transition-colors"
                                title="Spec sheet"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </a>
                            );
                          })()}
                        </div>
                      </div>
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
                      {pick.subtitle && (
                        <p className="font-body text-[10px] text-muted-foreground leading-tight">{pick.subtitle}</p>
                      )}
                      {pick.materials && (
                        <p className="font-body text-[9px] text-muted-foreground/60 mt-0.5 line-clamp-2 leading-relaxed">
                          {pick.materials}
                        </p>
                      )}
                      {pick.dimensions && (
                        <p className="font-body text-[9px] text-muted-foreground/50 mt-0.5">
                          {pick.dimensions.split('\n').filter(line => !line.toLowerCase().includes(' in')).join('\n')}
                        </p>
                      )}
                      {pick.trade_price_cents != null && (
                        <p className="font-display text-[11px] md:text-xs text-foreground mt-1">
                          {(isTradeUser || isAdmin)
                            ? `${pick.dimensions && pick.dimensions.includes('\n') ? 'From ' : ''}${formatPriceConverted(pick.trade_price_cents, pick.currency || 'EUR', displayCurrency, fxRates)}`
                            : "Price on request"}
                        </p>
                      )}
                      {pick.edition && (
                        <p className="font-body text-[9px] text-primary/70 mt-0.5 italic">
                          {pick.edition}
                        </p>
                      )}
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
      />
    </>
  );
};

export default TradeAtelierProfile;
