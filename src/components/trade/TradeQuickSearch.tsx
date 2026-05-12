import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight, MapPin, Image as ImageIcon, FolderOpen, Users, FileText, Box, Settings, Briefcase, Layers, Calendar, Palette, BookOpen, Layout, Compass } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type SectionItem = {
  type: "section";
  label: string;
  description?: string;
  to: string;
  anchor?: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
};

type DynamicItem = {
  type: "designer" | "product";
  label: string;
  sublabel?: string;
  to: string;
};

type ResultItem = SectionItem | DynamicItem;

const SECTIONS: SectionItem[] = [
  { type: "section", label: "Dashboard", description: "Trade home", to: "/trade", keywords: "home overview", icon: Layout },
  { type: "section", label: "Curated Showroom", description: "Hand-picked Singapore gallery", to: "/trade/showroom", keywords: "showroom singapore staged", icon: MapPin },
  { type: "section", label: "Full Catalogue", description: "Browse all products", to: "/trade/gallery", keywords: "gallery products catalogue catalog browse", icon: ImageIcon },
  { type: "section", label: "Designers & Ateliers", description: "Library of brands & designers", to: "/trade/designers", keywords: "brands ateliers library designers", icon: Users },
  { type: "section", label: "Resources", description: "Catalogues, inventory, spec sheets", to: "/trade/documents", keywords: "documents pdf spec sheet inventory pricelist resources", icon: FolderOpen },
  { type: "section", label: "Quotes", description: "Quote builder", to: "/trade/quotes", keywords: "quote builder estimates pricing", icon: FileText },
  { type: "section", label: "3D Studio", description: "Submit drawings for renders", to: "/trade/axonometric-requests", keywords: "3d render axonometric drawings", icon: Box },
  { type: "section", label: "Projects", description: "Project folders", to: "/trade/projects", keywords: "projects folders boards", icon: Briefcase },
  { type: "section", label: "Mood Boards", description: "Visual references", to: "/trade/mood-boards", keywords: "mood board references inspiration", icon: Palette },
  { type: "section", label: "Tearsheet Builder", description: "Branded export", to: "/trade/tearsheets", keywords: "tearsheet pdf export branded", icon: FileText },
  { type: "section", label: "FF&E Schedule", description: "Aggregated specifications", to: "/trade/ffe-schedule", keywords: "ff&e schedule specification fixtures", icon: Layers },
  { type: "section", label: "Order Timeline", description: "Project order kanban", to: "/trade/order-timeline", keywords: "order timeline kanban shipping", icon: Calendar },
  { type: "section", label: "Material Library", description: "Finishes & samples", to: "/trade/materials", keywords: "materials finishes samples", icon: Layers },
  { type: "section", label: "Clients", description: "Address book", to: "/trade/clients", keywords: "clients contacts address book", icon: Users },
  { type: "section", label: "Journal", description: "Editorial articles", to: "/trade/journal", keywords: "journal editorial articles", icon: BookOpen },
  { type: "section", label: "Settings", description: "Account & preferences", to: "/trade/settings", keywords: "settings account preferences password tier", icon: Settings },
  { type: "section", label: "Replay welcome", description: "Re-run the first-login flow", to: "/trade/settings#replay-welcome", keywords: "replay welcome onboarding tour", icon: Compass },
];

export function TradeQuickSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dynamic, setDynamic] = useState<DynamicItem[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Cmd/Ctrl+K and "/" shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset on open and focus
  useEffect(() => {
    if (open) {
      setQuery("");
      setDynamic([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounced fetch of designers + products
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setDynamic([]);
      return;
    }
    const handle = setTimeout(async () => {
      const [picks, brands] = await Promise.all([
        supabase
          .from("designer_curator_picks")
          .select("id, brand, title")
          .or(`title.ilike.%${q}%,brand.ilike.%${q}%`)
          .limit(8),
        supabase
          .from("designer_curator_picks")
          .select("brand")
          .ilike("brand", `%${q}%`)
          .limit(20),
      ]);
      const items: DynamicItem[] = [];
      const seenBrand = new Set<string>();
      brands.data?.forEach((row: any) => {
        const b = (row?.brand || "").trim();
        if (!b || seenBrand.has(b.toLowerCase())) return;
        seenBrand.add(b.toLowerCase());
        items.push({
          type: "designer",
          label: b,
          to: `/trade/designers/${encodeURIComponent(b.toLowerCase().replace(/\s+/g, "-"))}`,
        });
      });
      picks.data?.forEach((row: any) => {
        if (!row?.title) return;
        items.push({
          type: "product",
          label: row.title,
          sublabel: row.brand || undefined,
          to: `/trade/products/${row.id}`,
        });
      });
      setDynamic(items.slice(0, 12));
    }, 220);
    return () => clearTimeout(handle);
  }, [query, open]);

  const sectionResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS.slice(0, 8);
    return SECTIONS.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.keywords.includes(q)
    );
  }, [query]);

  const results: ResultItem[] = useMemo(
    () => [...sectionResults, ...dynamic],
    [sectionResults, dynamic]
  );

  useEffect(() => {
    if (active >= results.length) setActive(0);
  }, [results.length, active]);

  const go = (item: ResultItem) => {
    setOpen(false);
    if (item.to.includes("#")) {
      // Navigate then scroll to hash anchor
      const [path, hash] = item.to.split("#");
      navigate(path);
      setTimeout(() => {
        const el = document.getElementById(hash);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.classList.add("ring-2", "ring-foreground/40");
        setTimeout(() => el?.classList.remove("ring-2", "ring-foreground/40"), 1600);
      }, 200);
    } else {
      navigate(item.to);
    }
  };

  const onListKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[active];
      if (item) go(item);
    }
  };

  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 px-2.5 h-8 rounded-md border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground"
        aria-label="Search the trade portal"
        title="Search (⌘K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="font-body text-xs">Search…</span>
        <span className="ml-1 inline-flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 font-body text-[10px] text-muted-foreground">
          {isMac ? "⌘" : "Ctrl"}K
        </span>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-muted/50 transition-colors text-foreground"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden gap-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onListKey}
              placeholder="Search sections, designers, products…"
              className="flex-1 bg-transparent border-0 outline-none font-body text-sm text-foreground placeholder:text-muted-foreground"
            />
            <span className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 font-body text-[10px] text-muted-foreground">
              esc
            </span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {results.length === 0 && (
              <div className="px-4 py-8 text-center font-body text-xs text-muted-foreground">
                No matches.
              </div>
            )}
            {sectionResults.length > 0 && (
              <div className="px-2">
                <div className="px-2 pb-1 pt-1 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Sections
                </div>
                {sectionResults.map((item, idx) => {
                  const Icon = item.icon;
                  const i = idx;
                  return (
                    <button
                      key={`s-${item.to}`}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(item)}
                      className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors ${
                        active === i ? "bg-muted" : "hover:bg-muted/60"
                      }`}
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-background border border-border shrink-0">
                        <Icon className="h-4 w-4 text-foreground" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-display text-sm text-foreground truncate">{item.label}</span>
                        {item.description && (
                          <span className="block font-body text-[11px] text-muted-foreground truncate">{item.description}</span>
                        )}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
            {dynamic.length > 0 && (
              <div className="px-2 mt-2">
                <div className="px-2 pb-1 pt-1 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Catalogue
                </div>
                {dynamic.map((item, idx) => {
                  const i = sectionResults.length + idx;
                  return (
                    <button
                      key={`d-${item.to}-${idx}`}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(item)}
                      className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors ${
                        active === i ? "bg-muted" : "hover:bg-muted/60"
                      }`}
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-background border border-border shrink-0">
                        {item.type === "designer" ? <Users className="h-4 w-4 text-foreground" /> : <ImageIcon className="h-4 w-4 text-foreground" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-display text-sm text-foreground truncate">{item.label}</span>
                        {item.sublabel && (
                          <span className="block font-body text-[11px] text-muted-foreground truncate">{item.sublabel}</span>
                        )}
                      </span>
                      <span className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground shrink-0">
                        {item.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-border bg-muted/20">
            <span className="font-body text-[10px] text-muted-foreground">
              ↑↓ navigate · ↵ open · esc close
            </span>
            <span className="font-body text-[10px] text-muted-foreground">
              {isMac ? "⌘" : "Ctrl"}K to toggle
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TradeQuickSearch;
