import { useMemo, useState } from "react";
import { getAllTradeProducts } from "@/lib/tradeProducts";
import { CATEGORY_ORDER, SUBCATEGORY_MAP, normalizeCategory, normalizeSubcategory } from "@/lib/productTaxonomy";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Mismatch {
  productName: string;
  brandName: string;
  field: "category" | "subcategory";
  rawValue: string;
  canonicalValue: string;
}

const TaxonomyAudit = () => {
  const [open, setOpen] = useState(false);

  const { mismatches, orphanedSubcategories, totalProducts } = useMemo(() => {
    const products = getAllTradeProducts();
    const mismatches: Mismatch[] = [];
    const orphaned = new Set<string>();
    const allValidSubs = new Set(Object.values(SUBCATEGORY_MAP).flat());

    for (const p of products) {
      // Check category normalization
      const normalizedCat = normalizeCategory(p.category);
      if (normalizedCat && normalizedCat !== p.category) {
        // This means the raw value differs from canonical — but tradeProducts already normalizes,
        // so we check the raw source data indirectly
      }

      // Check if category is in canonical list
      if (!CATEGORY_ORDER.includes(p.category)) {
        mismatches.push({
          productName: p.product_name,
          brandName: p.brand_name,
          field: "category",
          rawValue: p.category,
          canonicalValue: normalizeCategory(p.category) || "Unknown",
        });
      }

      // Check subcategory
      if (p.subcategory) {
        if (!allValidSubs.has(p.subcategory)) {
          const canonical = normalizeSubcategory(p.subcategory);
          mismatches.push({
            productName: p.product_name,
            brandName: p.brand_name,
            field: "subcategory",
            rawValue: p.subcategory,
            canonicalValue: canonical || "Unmapped",
          });
        }

        // Check subcategory belongs to its parent category
        const validForCategory = SUBCATEGORY_MAP[p.category] || [];
        if (allValidSubs.has(p.subcategory) && !validForCategory.includes(p.subcategory)) {
          orphaned.add(`${p.subcategory} → ${p.category}`);
        }
      }
    }

    return { mismatches, orphanedSubcategories: [...orphaned], totalProducts: products.length };
  }, []);

  const isClean = mismatches.length === 0 && orphanedSubcategories.length === 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 text-left transition-colors",
          isClean ? "bg-emerald-500/10" : "bg-destructive/10"
        )}
      >
        <div className="flex items-center gap-2">
          {isClean ? (
            <CheckCircle size={16} className="text-emerald-500" />
          ) : (
            <AlertTriangle size={16} className="text-destructive" />
          )}
          <span className="font-body text-sm font-medium text-foreground">
            Taxonomy Audit
          </span>
          <span className="font-body text-xs text-muted-foreground">
            {totalProducts} products · {mismatches.length} issue{mismatches.length !== 1 ? "s" : ""}
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {isClean ? (
            <p className="font-body text-sm text-muted-foreground">
              All products use canonical category and subcategory labels. No issues found.
            </p>
          ) : (
            <>
              {mismatches.length > 0 && (
                <div>
                  <h4 className="font-body text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Non-Canonical Labels ({mismatches.length})
                  </h4>
                  <div className="space-y-1">
                    {mismatches.map((m, i) => (
                      <div key={i} className="flex items-start gap-3 py-2 px-3 rounded-md bg-muted/30 text-xs font-body">
                        <span className={cn(
                          "shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider",
                          m.field === "category" ? "bg-destructive/20 text-destructive" : "bg-amber-500/20 text-amber-600"
                        )}>
                          {m.field}
                        </span>
                        <div className="min-w-0">
                          <p className="text-foreground truncate">
                            <span className="text-muted-foreground">{m.brandName}</span> — {m.productName}
                          </p>
                          <p className="text-muted-foreground mt-0.5">
                            <span className="line-through">{m.rawValue}</span>
                            <span className="mx-1">→</span>
                            <span className="text-foreground font-medium">{m.canonicalValue}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {orphanedSubcategories.length > 0 && (
                <div>
                  <h4 className="font-body text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Mismatched Parent Categories ({orphanedSubcategories.length})
                  </h4>
                  <div className="space-y-1">
                    {orphanedSubcategories.map((o, i) => (
                      <div key={i} className="py-1.5 px-3 rounded-md bg-muted/30 text-xs font-body text-muted-foreground">
                        {o}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Canonical reference */}
          <details className="pt-2">
            <summary className="font-body text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              View canonical taxonomy
            </summary>
            <div className="mt-2 space-y-2">
              {CATEGORY_ORDER.map((cat) => (
                <div key={cat} className="text-xs font-body">
                  <span className="font-medium text-foreground">{cat}</span>
                  <span className="text-muted-foreground ml-2">
                    {(SUBCATEGORY_MAP[cat] || []).join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default TaxonomyAudit;
