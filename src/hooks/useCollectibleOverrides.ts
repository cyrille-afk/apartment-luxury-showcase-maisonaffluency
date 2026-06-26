import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { collectibleDesigners } from "@/components/Collectibles";

export type CollectibleOverride = { slug: string; trade_only: boolean };

export type AtelierOverride = {
  slug: string;
  name?: string | null;
  founder?: string | null;
  specialty?: string | null;
  hero_image_url?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
};

export type AtelierGalleryItem = {
  id: string;
  slug: string;
  image_url: string;
  caption?: string | null;
  position: number;
};

let tradeOnlyPromise: Promise<Set<string>> | null = null;
let atelierOverridePromise: Promise<Map<string, AtelierOverride>> | null = null;
let galleryPromise: Promise<Map<string, AtelierGalleryItem[]>> | null = null;

async function loadTradeOnlySlugs(): Promise<Set<string>> {
  if (!tradeOnlyPromise) {
    tradeOnlyPromise = (async () => {
      const { data, error } = await supabase
        .from("collectible_overrides" as any)
        .select("slug, trade_only");
      if (error || !data) return new Set<string>();
      return new Set(
        (data as any[]).filter((r) => r.trade_only).map((r) => String(r.slug))
      );
    })();
  }
  return tradeOnlyPromise;
}

async function loadAtelierOverrides(): Promise<Map<string, AtelierOverride>> {
  if (!atelierOverridePromise) {
    atelierOverridePromise = (async () => {
      const { data, error } = await supabase
        .from("collectible_atelier_overrides" as any)
        .select("slug, name, founder, specialty, hero_image_url, website_url, instagram_url");
      const map = new Map<string, AtelierOverride>();
      if (error || !data) return map;
      (data as any[]).forEach((r) => {
        map.set(String(r.slug), r as AtelierOverride);
      });
      return map;
    })();
  }
  return atelierOverridePromise;
}

async function loadAtelierGallery(): Promise<Map<string, AtelierGalleryItem[]>> {
  if (!galleryPromise) {
    galleryPromise = (async () => {
      const { data, error } = await supabase
        .from("collectible_atelier_gallery" as any)
        .select("id, slug, image_url, caption, position")
        .order("position", { ascending: true });
      const map = new Map<string, AtelierGalleryItem[]>();
      if (error || !data) return map;
      (data as any[]).forEach((r) => {
        const key = String(r.slug);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r as AtelierGalleryItem);
      });
      return map;
    })();
  }
  return galleryPromise;
}

export function invalidateCollectibleOverrides() {
  tradeOnlyPromise = null;
  atelierOverridePromise = null;
  galleryPromise = null;
}

export function useCollectibleTradeOnlySlugs(): Set<string> {
  const [set, setSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    loadTradeOnlySlugs().then((s) => {
      if (!cancelled) setSet(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return set;
}

export function useAtelierOverrides(): Map<string, AtelierOverride> {
  const [map, setMap] = useState<Map<string, AtelierOverride>>(new Map());
  useEffect(() => {
    let cancelled = false;
    loadAtelierOverrides().then((m) => {
      if (!cancelled) setMap(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return map;
}

export function useAtelierGallery(): Map<string, AtelierGalleryItem[]> {
  const [map, setMap] = useState<Map<string, AtelierGalleryItem[]>>(new Map());
  useEffect(() => {
    let cancelled = false;
    loadAtelierGallery().then((m) => {
      if (!cancelled) setMap(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return map;
}

function applyOverride<T extends (typeof collectibleDesigners)[number]>(
  d: T,
  ov: AtelierOverride | undefined
): T {
  if (!ov) return d;
  const links = [...(d.links || [])];
  if (ov.website_url || ov.instagram_url) {
    const filtered = links.filter(
      (l) =>
        l.type.toLowerCase() !== "website" &&
        l.type.toLowerCase() !== "instagram"
    );
    if (ov.website_url) filtered.unshift({ type: "Website", url: ov.website_url });
    if (ov.instagram_url) filtered.push({ type: "Instagram", url: ov.instagram_url });
    (d as any) = { ...d, links: filtered };
  }
  return {
    ...d,
    name: ov.name || d.name,
    founder: ov.founder ?? d.founder,
    specialty: ov.specialty || d.specialty,
    image: ov.hero_image_url || d.image,
  };
}

/** Filters trade-only entries for public viewers AND merges admin overrides. */
export function useVisibleCollectibleDesigners(): typeof collectibleDesigners {
  const tradeOnly = useCollectibleTradeOnlySlugs();
  const overrides = useAtelierOverrides();
  const { isTradeUser, isAdmin } = useAuth();
  const canSeeTradeOnly = isTradeUser || isAdmin;

  const base = collectibleDesigners.map((d) => {
    const key = String(d.id || d.name);
    return applyOverride(d, overrides.get(key));
  });

  if (canSeeTradeOnly || tradeOnly.size === 0) return base;
  return base.filter((d) => !tradeOnly.has(String(d.id || d.name)));
}
