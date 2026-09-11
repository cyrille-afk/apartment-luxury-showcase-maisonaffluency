import { Scale, X } from "lucide-react";
import { useCompare } from "@/contexts/CompareContext";
import { createPortal } from "react-dom";

const CompareFab = () => {
  const { items, setIsComparing, clearAll } = useCompare();

  if (items.length === 0) return null;

  return createPortal(
      <div className="fixed bottom-[45vh] md:bottom-8 right-4 md:right-8 z-[9999] flex items-center gap-2 animate-fade-in">
        {/* Clear button */}
        <button
          onClick={clearAll}
          className="p-2 rounded-full bg-foreground/80 text-background hover:bg-foreground transition-all shadow-lg backdrop-blur-sm"
          aria-label="Clear selection"
        >
          <X size={16} />
        </button>

        {/* Main FAB */}
        <button
          onClick={() => setIsComparing(true)}
          className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-foreground text-background shadow-[var(--shadow-elegant)] hover:shadow-xl font-body text-xs uppercase tracking-[0.12em] transition-all duration-300 hover:scale-105 border border-[hsl(var(--gold)/0.3)]"
        >
          <Scale size={16} />
          <span>Selection</span>
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[hsl(var(--gold))] text-foreground text-[10px] font-bold border border-black">
            {items.length}
          </span>
        </button>

        {/* Thumbnails preview */}
        <div className="hidden md:flex items-center -space-x-3 ml-1">
          {items.map((item, idx) => (
            <div
              key={`${item.designerId}-${item.pick.title}`}
              style={{ animationDelay: `${idx * 0.1}s` }}
              className="animate-slide-in w-10 h-10 rounded-full bg-[#f0eeeb] border-2 border-background overflow-hidden shadow-md"
            >
              <img
                src={item.pick.image}
                alt={item.pick.title}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>,
    document.body
  );
};

export default CompareFab;
