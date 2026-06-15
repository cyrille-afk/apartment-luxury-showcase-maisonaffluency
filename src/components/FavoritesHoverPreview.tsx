import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { supabase } from "@/integrations/supabase/client";
import { cloudinaryUrl } from "@/lib/cloudinary";

interface RecentPick {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
}

interface Props {
  favCount: number;
  children: React.ReactNode;
}

const LS_KEY = "public_favorites";
const MAX_RECENT = 4;

function readRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    // Most recently added are at the end of the array.
    return arr.slice(-MAX_RECENT).reverse();
  } catch {
    return [];
  }
}

const FavoritesHoverPreview = ({ favCount, children }: Props) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<RecentPick[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const ids = readRecentIds();
    if (ids.length === 0) {
      setPicks([]);
      return;
    }
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("designer_curator_picks_public")
        .select("id, title, subtitle, image_url")
        .in("id", ids);
      if (cancelled) return;
      // Preserve recency order
      const byId = new Map((data || []).map((d: any) => [d.id, d]));
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as RecentPick[];
      setPicks(ordered);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open]);

  const isEmpty = favCount === 0;

  return (
    <HoverCard openDelay={120} closeDelay={120} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent align="end" className="w-80 p-0 bg-background border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-display text-sm tracking-wide text-foreground">Recent Favorites</span>
          <button
            onClick={() => { setOpen(false); navigate("/favorites"); }}
            className="font-body text-[10px] uppercase tracking-[0.15em] text-foreground hover:text-primary transition-colors"
          >
            View all{favCount > 0 ? ` (${favCount})` : ""}
          </button>
        </div>

        {isEmpty ? (
          <div className="px-4 py-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Heart className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-display text-sm text-foreground mb-1">Save pieces you love</p>
            <p className="font-body text-xs text-muted-foreground">
              Tap the heart on any piece to keep it close at hand.
            </p>
          </div>
        ) : loading || picks === null ? (
          <div className="grid grid-cols-2 gap-2 p-3">
            {Array.from({ length: Math.min(favCount, MAX_RECENT) }).map((_, i) => (
              <div key={i} className="aspect-square bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-3">
            {picks.map((p) => (
              <button
                key={p.id}
                onClick={() => { setOpen(false); navigate("/favorites"); }}
                className="group text-left"
              >
                <div className="aspect-square overflow-hidden rounded bg-muted">
                  <img
                    src={
                      p.image_url?.startsWith("http")
                        ? p.image_url.replace(
                            /\/image\/upload\/(?:[^/]+\/)?(v\d+\/)/,
                            "/image/upload/w_240,h_240,c_fill,q_auto,f_auto/$1"
                          )
                        : cloudinaryUrl(p.image_url, { width: 240, height: 240, crop: "fill", quality: "auto", format: "auto" })
                    }
                    alt={p.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="mt-1.5 font-body text-[11px] text-foreground line-clamp-1">{p.title}</p>
                {p.subtitle && (
                  <p className="font-body text-[10px] text-muted-foreground line-clamp-1">{p.subtitle}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};

export default FavoritesHoverPreview;
