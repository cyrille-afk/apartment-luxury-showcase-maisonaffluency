import { motion, AnimatePresence } from "framer-motion";
import { Scale, X } from "lucide-react";
import { useCompare } from "@/contexts/CompareContext";
import { createPortal } from "react-dom";

const CompareFab = () => {
  const { items, setIsComparing, clearAll } = useCompare();

  if (items.length === 0) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
        className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-[9999] flex items-center gap-2"
      >
        {/* Clear button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={clearAll}
          className="p-2 rounded-full bg-foreground/80 text-background hover:bg-foreground transition-all shadow-lg backdrop-blur-sm"
          aria-label="Clear selection"
        >
          <X size={16} />
        </motion.button>

        {/* Main FAB */}
        <button
          onClick={() => setIsComparing(true)}
          className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-foreground text-background shadow-[var(--shadow-elegant)] hover:shadow-xl font-body text-xs uppercase tracking-[0.12em] transition-all duration-300 hover:scale-105 border border-[hsl(var(--gold)/0.3)]"
        >
          <Scale size={16} />
          <span>Selection</span>
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[hsl(var(--gold))] text-foreground text-[10px] font-bold">
            {items.length}
          </span>
        </button>

        {/* Thumbnails preview */}
        <div className="hidden md:flex items-center -space-x-3 ml-1">
          {items.map((item, idx) => (
            <motion.div
              key={`${item.designerId}-${item.pick.title}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="w-10 h-10 rounded-full bg-[#f0eeeb] border-2 border-background overflow-hidden shadow-md"
            >
              <img
                src={item.pick.image}
                alt={item.pick.title}
                className="w-full h-full object-cover"
              />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default CompareFab;
