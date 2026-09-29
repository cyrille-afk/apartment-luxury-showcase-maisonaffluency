import { useEffect, useState } from "react";

/**
 * Gallery curation layer for product grids.
 * 1. No more than two consecutive pieces from the same brand/designer.
 * 2. Never two dark (heavy, full-bleed) photos side by side — a light
 *    shot is slotted between them.
 * Greedy, order-preserving: the earliest valid candidate wins, and rules
 * are relaxed (tone first, then brand) only when nothing else fits.
 */
export type Tone = "dark" | "light";

export function curateGrid<T>(
  items: T[],
  brandOf: (item: T) => string,
  toneOf: (item: T) => Tone | undefined,
  maxRun = 2,
): T[] {
  const rest = [...items];
  const out: T[] = [];
  const brandOk = (c: T) => {
    if (out.length < maxRun) return true;
    const b = brandOf(c);
    return !out.slice(-maxRun).every((x) => brandOf(x) === b);
  };
  const toneOk = (c: T) =>
    !(out.length && toneOf(out[out.length - 1]) === "dark" && toneOf(c) === "dark");
  while (rest.length) {
    let i = rest.findIndex((c) => brandOk(c) && toneOk(c));
    if (i < 0) i = rest.findIndex(brandOk);
    if (i < 0) i = 0;
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}

const CACHE_KEY = "ma_img_tone_v1";
const mem: Record<string, Tone> = (() => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
})();
let saveTimer: number | undefined;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(mem)); } catch { /* quota */ }
  }, 500);
};

const thumb = (url: string) =>
  url.includes("res.cloudinary.com") && url.includes("/upload/")
    ? url.replace("/upload/", "/upload/w_16,h_16,c_fill,f_png/")
    : url;

function measure(url: string): Promise<Tone | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 16;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 16, 16);
        const d = ctx.getImageData(0, 0, 16, 16).data;
        let sum = 0, n = 0;
        for (let p = 0; p < d.length; p += 4) {
          const a = d[p + 3] / 255;
          // transparent pixels sit on the light card canvas
          const l = (0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) / 255;
          sum += l * a + (1 - a); n++;
        }
        resolve(sum / n < 0.4 ? "dark" : "light");
      } catch { resolve(undefined); }
    };
    img.onerror = () => resolve(undefined);
    img.src = thumb(url);
  });
}

/** Returns a tone lookup for image URLs, measured once and cached locally. */
export function useImageTones(urls: string[]): Record<string, Tone> {
  const key = urls.join("|");
  const [, bump] = useState(0);
  useEffect(() => {
    let alive = true;
    const todo = urls.filter((u) => u && !(u in mem));
    if (!todo.length) return;
    Promise.all(todo.map(async (u) => { const t = await measure(u); if (t) mem[u] = t; }))
      .then(() => { persist(); if (alive) bump((x) => x + 1); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return mem;
}
