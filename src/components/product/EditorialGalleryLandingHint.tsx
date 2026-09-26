import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Images } from "lucide-react";

interface EditorialGalleryLandingHintProps {
  onClick?: () => void;
  className?: string;
  tone?: "light" | "hero";
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
        "hidden md:flex items-center font-body uppercase transition-all duration-700 ease-out",
        tone === "hero"
          ? "isolate font-light text-primary-foreground drop-shadow-lg hover:opacity-70"
          : "gap-2 rounded-full border border-border/60 bg-background/90 px-4 py-2.5 text-[11px] tracking-[0.14em] text-foreground shadow-lg backdrop-blur-sm hover:bg-background",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none",
        className
      )}
    >
      {tone !== "hero" && <Images className="h-3.5 w-3.5" />}
      View Editorial Gallery
    </button>
  );
}
