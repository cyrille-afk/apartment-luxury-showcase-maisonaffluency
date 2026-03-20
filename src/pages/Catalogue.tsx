import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, X, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_ORDER, SUBCATEGORY_MAP } from "@/lib/productTaxonomy";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import WhatsAppShareButton from "@/components/WhatsAppShareButton";
import { sharePageOnWhatsApp } from "@/lib/whatsapp-share";

interface CatalogueProduct {
  id: string;
  product_name: string;
  brand_name: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  image_url: string | null;
  materials: string | null;
  dimensions: string | null;
}

/** Optimise Cloudinary URLs for catalogue grid cards */
function optimiseImage(url: string | null, width = 600): string {
  if (!url) return "/placeholder.svg";
  if (url.includes("cloudinary.com") && url.includes("/upload/")) {
    const cleaned = url.replace(/\/upload\/[^v][^/]*(?:\/[^v][^/]*)*\//, "/upload/");
    return cleaned.replace("/upload/", `/upload/w_${width},c_fill,q_auto,f_auto/`);
  }
  return url;
}

const Catalogue = () => {
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, category, subcategory, description, image_url, materials, dimensions")
        .eq("is_active", true)
        .order("brand_name", { ascending: true });
      setProducts((data as CatalogueProduct[]) || []);
      setLoading(false);
    };
    fetchProducts();
  }, []);

  /** Normalise a string for comparison: collapse whitespace, trim, lowercase */
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

  // Deduplicate: exact brand+product match, AND near-duplicates where one product
  // name is a prefix/substring of another by the same brand (e.g. "Corteza Console"
  // vs "Corteza Console Table") — keep the shorter, more canonical name.
  const deduped = useMemo(() => {
    // First pass: group by normalised brand
    const byBrand = new Map<string, CatalogueProduct[]>();
    for (const p of products) {
      const bk = norm(p.brand_name);
      const arr = byBrand.get(bk) || [];
      arr.push(p);
      byBrand.set(bk, arr);
    }

    const result: CatalogueProduct[] = [];
    for (const [, brandItems] of byBrand) {
      // Sort by product name length so shorter (canonical) names come first
      const sorted = [...brandItems].sort(
        (a, b) => a.product_name.length - b.product_name.length
      );
      const kept: CatalogueProduct[] = [];
      const seenNames = new Set<string>();

      for (const p of sorted) {
        const pn = norm(p.product_name);
        // Skip if exact duplicate
        if (seenNames.has(pn)) continue;
        // Skip if this name starts with an already-kept name (near-duplicate)
        const isDupe = [...seenNames].some(
          (existing) => pn.startsWith(existing) && pn.length - existing.length <= 12
        );
        if (isDupe) continue;
        seenNames.add(pn);
        kept.push(p);
      }
      result.push(...kept);
    }
    return result;
  }, [products]);

  const subcategories = activeCategory ? (SUBCATEGORY_MAP[activeCategory] || []) : [];

  const filtered = useMemo(() => {
    let list = deduped;
    if (activeCategory) list = list.filter(p => p.category === activeCategory);
    if (activeSubcategory) list = list.filter(p => p.subcategory === activeSubcategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.product_name.toLowerCase().includes(q) ||
        p.brand_name.toLowerCase().includes(q) ||
        p.materials?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [deduped, activeCategory, activeSubcategory, search]);

  // Group by brand (case-insensitive merge)
  const grouped = useMemo(() => {
    const map = new Map<string, { displayName: string; products: CatalogueProduct[] }>();
    for (const p of filtered) {
      const key = p.brand_name.trim().toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.products.push(p);
      } else {
        map.set(key, { displayName: p.brand_name.trim(), products: [p] });
      }
    }
    return [...map.values()]
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [filtered]);

  const clearFilters = () => {
    setActiveCategory(null);
    setActiveSubcategory(null);
    setSearch("");
  };

  const hasFilters = !!activeCategory || !!activeSubcategory || !!search;

  return (
    <>
      <Helmet>
        <title>Catalogue — Maison Affluency | Luxury Furniture & Collectible Design</title>
        <meta name="description" content="Browse our curated selection of luxury furniture, lighting, and collectible design pieces by world-renowned designers and ateliers. Price on request." />
        <link rel="canonical" href="https://maisonaffluency.com/catalogue" />
        <meta property="og:title" content="Catalogue — Maison Affluency" />
        <meta property="og:description" content="Curated luxury furniture and collectible design — seating, tables, lighting, décor from emerging talents and design masters." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://maisonaffluency.com/catalogue" />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772516480/WhatsApp_Image_2026-03-03_at_1.40.10_PM_cs23b7.jpg" />
      </Helmet>

      <Navigation />

      <main className="min-h-screen bg-background pt-20 md:pt-24">
        {/* Header */}
        <section className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <h1 className="font-display text-3xl md:text-4xl text-foreground tracking-wide">
                Catalogue
              </h1>
              <p className="font-body text-sm text-muted-foreground mt-2 max-w-xl">
                A curated selection of exceptional furniture, lighting, and collectible design from our gallery and partner ateliers worldwide.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <WhatsAppShareButton
                onClick={(e) => {
                  e.preventDefault();
                  sharePageOnWhatsApp("/catalogue", "Catalogue — Maison Affluency", "Curated luxury furniture & collectible design");
                }}
                label="Share catalogue on WhatsApp"
                size="sm"
                variant="branded"
              />
              <Link
                to="/trade/program"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity"
              >
                Trade Program
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Search + Filter Toggle */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name, designer, or material…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 font-body text-sm bg-card border-border"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-1.5 font-body text-xs uppercase tracking-wider"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter
              {hasFilters && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-secondary" />
              )}
            </Button>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1 font-body text-xs text-muted-foreground"
              >
                <X className="w-3 h-3" />
                Clear
              </Button>
            )}
          </div>

          {/* Category Filters */}
          {showFilters && (
            <div className="mb-8 pb-6 border-b border-border space-y-4 animate-in slide-in-from-top-2 duration-200">
              <div>
                <p className="font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-3">Category</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_ORDER.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setActiveCategory(activeCategory === cat ? null : cat);
                        setActiveSubcategory(null);
                      }}
                      className={`px-3 py-1.5 rounded-full font-body text-xs transition-all border ${
                        activeCategory === cat
                          ? "bg-foreground text-background border-foreground"
                          : "bg-transparent text-muted-foreground border-border hover:border-foreground/40"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {subcategories.length > 0 && (
                <div>
                  <p className="font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-3">Type</p>
                  <div className="flex flex-wrap gap-2">
                    {subcategories.map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setActiveSubcategory(activeSubcategory === sub ? null : sub)}
                        className={`px-3 py-1.5 rounded-full font-body text-xs transition-all border ${
                          activeSubcategory === sub
                            ? "bg-foreground text-background border-foreground"
                            : "bg-transparent text-muted-foreground border-border hover:border-foreground/40"
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results count */}
          <p className="font-body text-xs text-muted-foreground mb-6">
            {loading ? "Loading…" : `${filtered.length} piece${filtered.length !== 1 ? "s" : ""}`}
            {activeCategory && <span> in {activeCategory}</span>}
            {activeSubcategory && <span> · {activeSubcategory}</span>}
          </p>

          {/* Loading Skeletons */}
          {loading && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[3/4] w-full rounded-sm" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-20">
              <p className="font-display text-lg text-foreground mb-2">No pieces found</p>
              <p className="font-body text-sm text-muted-foreground mb-4">
                Try adjusting your filters or search terms.
              </p>
              <Button variant="outline" size="sm" onClick={clearFilters} className="font-body text-xs">
                Clear all filters
              </Button>
            </div>
          )}

          {/* Product Grid grouped by designer */}
          {!loading && grouped.map(({ displayName, products: brandProducts }) => (
            <section key={displayName} className="mb-12">
              <div className="flex items-baseline gap-3 mb-4 border-b border-border pb-2">
                <h2 className="font-display text-base md:text-lg text-foreground tracking-wide">
                  {displayName}
                </h2>
                <span className="font-body text-[11px] text-muted-foreground">
                  {brandProducts.length} piece{brandProducts.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {brandProducts.map((product) => (
                  <Link
                    key={product.id}
                    to={`/product/${product.id}`}
                    className="group block"
                  >
                    <div className="aspect-[3/4] overflow-hidden rounded-sm bg-muted mb-3">
                      <img
                        src={optimiseImage(product.image_url)}
                        alt={`${product.product_name} by ${product.brand_name}`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-display text-xs md:text-sm text-foreground leading-tight line-clamp-1">
                        {product.product_name}
                      </p>
                      {product.category && (
                        <p className="font-body text-[11px] text-muted-foreground">
                          {product.subcategory || product.category}
                        </p>
                      )}
                      {product.materials && (
                        <p className="font-body text-[10px] text-muted-foreground/70 line-clamp-1">
                          {product.materials}
                        </p>
                      )}
                      <p className="font-body text-[11px] text-accent-foreground/60 italic mt-1">
                        Price on request
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {/* CTA Banner */}
          {!loading && products.length > 0 && (
            <div className="mt-16 mb-8 py-10 px-6 md:px-12 bg-card border border-border rounded-sm text-center">
              <h2 className="font-display text-lg md:text-xl text-foreground mb-2">
                Interested in trade pricing?
              </h2>
              <p className="font-body text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                Join our Trade Program for exclusive pricing, dedicated advisory, samples, and consolidated insured shipping.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link
                  to="/trade/register"
                  className="inline-flex px-6 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity"
                >
                  Apply Now
                </Link>
                <Link
                  to="/trade/program"
                  className="inline-flex px-6 py-2.5 border border-foreground text-foreground font-body text-xs uppercase tracking-[0.15em] rounded-full hover:bg-foreground hover:text-background transition-all"
                >
                  Learn More
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </>
  );
};

export default Catalogue;
