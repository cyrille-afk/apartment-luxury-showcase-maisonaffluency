import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Images } from "lucide-react";

interface EditorialGalleryLandingHintProps {
  onClick?: () => void;
  className?: string;
  tone?: "light" | "crimson";
}

export default function EditorialGalleryLandingHint({
  onClick,
  className,
  tone = "light",
}: EditorialGalleryLandingHintProps) {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={() => {
        setVisible(false);
        onClick?.();
      }}
      className={cn(
        "hidden md:flex items-center gap-2 px-4 py-2.5 rounded-full",
        "backdrop-blur-sm shadow-lg font-body uppercase transition-all duration-700 ease-out",
        tone === "crimson"
          ? "bg-[#5a1622]/85 border border-[#8a2438]/60 text-[#f5e6ea] text-[11px] tracking-[0.22em] hover:bg-[#6b1b2a]/90"
          : "bg-background/90 border border-border/60 text-foreground text-[11px] tracking-[0.14em] hover:bg-background",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none",
        className
      )}
    >
      <Images className="h-3.5 w-3.5" />
      View Editorial Gallery
    </button>
  );
}
