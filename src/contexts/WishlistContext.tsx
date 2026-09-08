import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FAV_EVENT,
  addFavorite as addFavoriteLocal,
  removeFavorite as removeFavoriteLocal,
  readFavorites,
} from "@/lib/favoriteFolders";

export interface WishlistItemMeta {
  title?: string;
  designer?: string;
  imageUrl?: string | null;
}

interface WishlistContextValue {
  favoriteIds: string[];
  count: number;
  isFavorited: (id: string) => boolean;
  addToWishlist: (id: string, meta?: WishlistItemMeta) => void;
  removeFromWishlist: (id: string) => void;
  /** Returns the new favorited state. */
  toggleWishlist: (id: string, meta?: WishlistItemMeta) => boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

interface Notice extends WishlistItemMeta {
  key: number;
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const read = () => {
      try { setFavoriteIds(readFavorites()); } catch { setFavoriteIds([]); }
    };
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === "public_favorites") read(); };
    window.addEventListener(FAV_EVENT, read);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(FAV_EVENT, read);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  const showNotice = useCallback((meta?: WishlistItemMeta) => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setNotice({ key: Date.now(), ...meta });
    setVisible(false);
    timers.current.push(window.setTimeout(() => setVisible(true), 20));
    timers.current.push(window.setTimeout(() => setVisible(false), 3000));
    timers.current.push(window.setTimeout(() => setNotice(null), 3500));
  }, []);

  const addToWishlist = useCallback((id: string, meta?: WishlistItemMeta) => {
    addFavoriteLocal(id);
    showNotice(meta);
  }, [showNotice]);

  const removeFromWishlist = useCallback((id: string) => {
    removeFavoriteLocal(id);
  }, []);

  const isFavorited = useCallback(
    (id: string) => favoriteIds.includes(id),
    [favoriteIds],
  );

  const toggleWishlist = useCallback((id: string, meta?: WishlistItemMeta) => {
    const wasFav = readFavorites().includes(id);
    if (wasFav) {
      removeFavoriteLocal(id);
      return false;
    }
    addFavoriteLocal(id);
    showNotice(meta);
    return true;
  }, [showNotice]);

  const value = useMemo<WishlistContextValue>(() => ({
    favoriteIds,
    count: favoriteIds.length,
    isFavorited,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
  }), [favoriteIds, isFavorited, addToWishlist, removeFromWishlist, toggleWishlist]);

  return (
    <WishlistContext.Provider value={value}>
      {children}
      {notice && typeof document !== "undefined" && createPortal(
        <div
          role="status"
          aria-live="polite"
          className={[
            "pointer-events-none fixed z-[120] transition-all duration-500 ease-out",
            // mobile: bottom-center · desktop: top-right
            "left-4 right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))]",
            "md:left-auto md:bottom-auto md:right-6 md:top-24 md:w-[320px]",
            visible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-3 md:translate-y-[-12px]",
          ].join(" ")}
        >
          <div className="flex items-center gap-3 border border-border/70 bg-background/95 px-3.5 py-3 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.55)] backdrop-blur-md">
            {notice.imageUrl ? (
              <img
                src={notice.imageUrl}
                alt=""
                aria-hidden="true"
                className="h-12 w-12 flex-shrink-0 object-cover"
                loading="lazy"
              />
            ) : null}
            <div className="min-w-0">
              <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Added to your Collectibles
              </p>
              {notice.title && (
                <p className="mt-1 truncate font-heading text-sm text-foreground">{notice.title}</p>
              )}
              {notice.designer && (
                <p className="truncate font-body text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                  {notice.designer}
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return ctx;
}
