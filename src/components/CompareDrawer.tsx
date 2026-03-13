import { motion, AnimatePresence } from "framer-motion";
import { X, Ruler, Layers, MessageSquareQuote, Trash2 } from "lucide-react";
import { useCompare } from "@/contexts/CompareContext";
import { useState } from "react";
import QuoteRequestDialog from "./QuoteRequestDialog";

const CompareDrawer = () => {
  const { items, isComparing, setIsComparing, removeItem, clearAll } = useCompare();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteProduct, setQuoteProduct] = useState<{ name?: string; designer?: string }>({});

  if (!isComparing || items.length === 0) return null;

  const colClass = items.length === 1 ? "grid-cols-1 max-w-md" : items.length === 2 ? "grid-cols-2 max-w-4xl" : "grid-cols-3 max-w-6xl";

  return (
    <>
      <AnimatePresence>
        {isComparing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h2 className="font-display text-xl md:text-2xl text-white">Selection</h2>
                <p className="font-body text-xs text-white/50 mt-0.5">{items.length} of 3 items selected</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/20 text-white/60 hover:text-white hover:border-white/40 font-body text-xs uppercase tracking-[0.12em] transition-all"
                >
                  <Trash2 size={14} />
                  Clear All
                </button>
                <button
                  onClick={() => setIsComparing(false)}
                  className="p-2.5 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all"
                  aria-label="Close comparison"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Comparison Grid */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8">
              <div className={`grid ${colClass} gap-6 md:gap-8 mx-auto`}>
                {items.map((item, idx) => (
                  <motion.div
                    key={`${item.designerId}-${item.pick.title}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                    className="flex flex-col h-full"
                  >
                    {/* Image */}
                    <div className="relative aspect-[4/5] bg-[#f0eeeb] rounded-sm overflow-hidden flex items-center justify-center mb-4">
                      <img
                        src={item.pick.image}
                        alt={item.pick.title}
                        className="max-w-[85%] max-h-[85%] object-contain"
                        style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.05)" }}
                      />
                      <button
                        onClick={() => removeItem(item.pick.title)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-all backdrop-blur-sm"
                        aria-label={`Remove ${item.pick.title}`}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Info */}
                    <div className="space-y-3 flex flex-col flex-1">
                      <div>
                        <p className="font-body text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--gold))]">
                          {item.designerName}
                        </p>
                        <h3 className="font-display text-base md:text-lg text-white mt-1 leading-tight">
                          {item.pick.title}
                        </h3>
                        {item.pick.subtitle && (
                          <p className="font-body text-xs text-white/50 mt-0.5">{item.pick.subtitle}</p>
                        )}
                      </div>

                      {/* Materials */}
                      {item.pick.materials && (
                        <div className="flex gap-2 items-start">
                          <Layers size={14} className="text-[hsl(var(--gold))] mt-0.5 shrink-0" />
                          <p className="font-body text-xs text-white/70 leading-relaxed">
                            {item.pick.materials}
                          </p>
                        </div>
                      )}

                      {/* Dimensions */}
                      {item.pick.dimensions && (
                        <div className="flex gap-2 items-start">
                          <Ruler size={14} className="text-[hsl(var(--gold))] mt-0.5 shrink-0" />
                          <p className="font-body text-sm text-white font-medium">
                            {item.pick.dimensions}
                          </p>
                        </div>
                      )}

                      {/* Category */}
                      {item.pick.category && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider font-body bg-white/10 text-white/60 rounded-full border border-white/10">
                            {item.pick.category}
                          </span>
                          {item.pick.subcategory && item.pick.subcategory !== item.pick.category && (
                            <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider font-body bg-white/10 text-white/60 rounded-full border border-white/10">
                              {item.pick.subcategory}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Quote button */}
                      <button
                        onClick={() => {
                          setQuoteProduct({ name: item.pick.title, designer: item.designerName });
                          setQuoteOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 mt-2 rounded-full border border-[hsl(var(--gold))] bg-white/5 text-white hover:bg-white/10 font-body text-[10px] uppercase tracking-[0.12em] transition-all w-full justify-center"
                      >
                        <MessageSquareQuote size={14} />
                        Request a Quote
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <QuoteRequestDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        productName={quoteProduct.name}
        designerName={quoteProduct.designer}
      />
    </>
  );
};

export default CompareDrawer;
