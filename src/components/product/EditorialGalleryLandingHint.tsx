import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Images } from "lucide-react";

interface EditorialGalleryLandingHintProps {
  onClick?: () => void;
  className?: string;
}

export default function EditorialGalleryLandingHint({
  onClick,
  className,
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
        "bg-background/90 backdrop-blur-sm border border-border/60 shadow-lg",
        "font-body text-[11px] uppercase tracking-[0.14em] text-foreground",
        "transition-all duration-700 ease-out hover:bg-background",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none",
        className
      )}
    >
      <Images className="h-3.5 w-3.5" />
      View Editorial Gallery
    </button>
  );
}
