import { useState } from "react";
import { CheckSquare, Square, ChevronDown, ChevronUp, ListChecks } from "lucide-react";

interface ChecklistProduct {
  id: string;
  product_name: string;
  brand_name: string;
  image_url: string;
}

interface ProductChecklistProps {
  products: ChecklistProduct[];
}

export default function ProductChecklist({ products }: ProductChecklistProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);

  if (products.length === 0) return null;

  const checkedCount = Object.values(checked).filter(Boolean).length;
  const allChecked = checkedCount === products.length;

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="absolute top-2 right-2 z-20 w-52 bg-background/90 backdrop-blur-sm border border-border rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-display text-[10px] text-foreground">
            Product Check
          </span>
          <span
            className={`font-body text-[9px] px-1 py-0.5 rounded-full ${
              allChecked
                ? "bg-green-500/15 text-green-700 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {checkedCount}/{products.length}
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-3 h-3 text-muted-foreground" />
        )}
      </button>

      {/* Items */}
      {!collapsed && (
        <div className="max-h-48 overflow-y-auto border-t border-border">
          {products.map((p) => {
            const isChecked = !!checked[p.id];
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted/40 transition-colors ${
                  isChecked ? "opacity-60" : ""
                }`}
              >
                {isChecked ? (
                  <CheckSquare className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <img
                  src={p.image_url}
                  alt={p.product_name}
                  className="w-6 h-6 rounded object-cover border border-border shrink-0"
                />
                <div className="min-w-0">
                  <p
                    className={`font-body text-[9px] truncate ${
                      isChecked
                        ? "line-through text-muted-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {p.product_name}
                  </p>
                  <p className="font-body text-[8px] text-muted-foreground truncate">
                    {p.brand_name}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
