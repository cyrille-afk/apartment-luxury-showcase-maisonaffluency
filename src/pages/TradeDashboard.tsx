import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Image, FileText, FolderOpen, FolderClosed, FileSpreadsheet, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface BrandFolder {
  brand_name: string;
  doc_count: number;
}

const quickLinks = [
  { title: "Browse Gallery", description: "View our full collection with trade pricing", icon: Image, to: "/trade/gallery" },
  { title: "Quote Builder", description: "Create branded quotes for your clients", icon: FileText, to: "/trade/quotes" },
  { title: "Documents", description: "Access catalogues, inventory & spec sheets", icon: FolderOpen, to: "/trade/documents" },
];

const TradeDashboard = () => {
  const { profile } = useAuth();
  const [brands, setBrands] = useState<BrandFolder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBrands = async () => {
      const { data } = await supabase
        .from("trade_documents")
        .select("brand_name");
      if (data) {
        const countMap = new Map<string, number>();
        for (const row of data) {
          countMap.set(row.brand_name, (countMap.get(row.brand_name) || 0) + 1);
        }
        // Get unique brand names from trade_products too (may have no documents)
        const { data: products } = await supabase
          .from("trade_products")
          .select("brand_name");
        if (products) {
          for (const p of products) {
            if (!countMap.has(p.brand_name)) countMap.set(p.brand_name, 0);
          }
        }
        const sorted = [...countMap.entries()]
          .map(([brand_name, doc_count]) => ({ brand_name, doc_count }))
          .sort((a, b) => a.brand_name.localeCompare(b.brand_name));
        setBrands(sorted);
      }
      setLoading(false);
    };
    fetchBrands();
  }, []);

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl text-foreground">
          Welcome back{profile?.first_name ? `, ${profile.first_name}` : ""}
        </h1>
        <p className="font-body text-sm text-muted-foreground mt-2">
          {profile?.company && <span>{profile.company} · </span>}
          Your trade dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="group border border-border rounded-lg p-6 hover:border-foreground/20 hover:shadow-sm transition-all"
          >
            <link.icon className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors mb-4" />
            <h3 className="font-display text-base text-foreground mb-1">{link.title}</h3>
            <p className="font-body text-xs text-muted-foreground">{link.description}</p>
          </Link>
        ))}
      </div>

      {/* Brand Folders */}
      <div className="mt-10">
        <h2 className="font-display text-lg text-foreground mb-4">Brands</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : brands.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <p className="font-body text-sm text-muted-foreground">
              No brands available yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {brands.map((brand) => {
              const isEmpty = brand.doc_count === 0;
              return (
                <Link
                  key={brand.brand_name}
                  to={`/trade/documents?brand=${encodeURIComponent(brand.brand_name)}`}
                  className={`group flex flex-col items-center gap-2 border rounded-lg p-4 transition-all ${
                    isEmpty
                      ? "border-border/60 opacity-60 hover:opacity-80"
                      : "border-border hover:border-foreground/20 hover:shadow-sm"
                  }`}
                >
                  {isEmpty ? (
                    <FolderClosed className="h-8 w-8 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
                  ) : (
                    <FolderOpen className="h-8 w-8 text-accent group-hover:text-foreground transition-colors" />
                  )}
                  <span className="font-body text-xs text-foreground text-center leading-tight truncate w-full">
                    {brand.brand_name}
                  </span>
                  <span className={`font-body text-[10px] ${isEmpty ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                    {isEmpty ? "Empty" : `${brand.doc_count} ${brand.doc_count === 1 ? "file" : "files"}`}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TradeDashboard;
