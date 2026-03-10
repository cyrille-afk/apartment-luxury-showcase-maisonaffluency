export type CuratorPickWithImage = {
  image?: string | null;
};

type ImagePriority = "high" | "auto" | "low";

declare global {
  interface Window {
    requestIdleCallback?: (
      callback: () => void,
      options?: { timeout?: number }
    ) => number;
  }
}

const preloadCache = new Map<string, Promise<void>>();

function createPreloadPromise(src: string, priority: ImagePriority): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof Image === "undefined") {
      resolve();
      return;
    }

    const img = new Image();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    img.decoding = priority === "high" ? "sync" : "async";
    try {
      (img as HTMLImageElement & { fetchPriority?: ImagePriority }).fetchPriority = priority;
    } catch {
      // Ignore unsupported browsers.
    }

    img.onload = finish;
    img.onerror = finish;
    img.src = src;

    if (img.complete) {
      finish();
      return;
    }

    if (typeof img.decode === "function") {
      img.decode().then(finish).catch(() => undefined);
    }
  });
}

export function preloadImage(src?: string | null, priority: ImagePriority = "high"): Promise<void> {
  if (!src) return Promise.resolve();

  const cached = preloadCache.get(src);
  if (cached) return cached;

  const promise = createPreloadPromise(src, priority);
  preloadCache.set(src, promise);
  return promise;
}

function getPreloadOrder(length: number, startIndex: number) {
  if (length <= 0) return [] as number[];

  const normalizedStart = ((startIndex % length) + length) % length;
  const order = [normalizedStart];

  for (let offset = 1; offset < length; offset += 1) {
    order.push((normalizedStart + offset) % length);
    order.push((normalizedStart - offset + length) % length);
  }

  return [...new Set(order)].slice(0, length);
}

export function warmCuratorPickSet(picks: CuratorPickWithImage[], startIndex = 0) {
  if (!picks.length || typeof window === "undefined") return Promise.resolve();

  const order = getPreloadOrder(picks.length, startIndex);
  const immediateIndices = order.slice(0, Math.min(5, order.length));
  const deferredIndices = order.slice(immediateIndices.length);

  immediateIndices.forEach((pickIndex, orderIndex) => {
    const src = picks[pickIndex]?.image;
    if (!src) return;

    window.setTimeout(() => {
      void preloadImage(src, orderIndex === 0 ? "high" : "auto");
    }, orderIndex * 40);
  });

  const scheduleDeferred = () => {
    deferredIndices.forEach((pickIndex, orderIndex) => {
      const src = picks[pickIndex]?.image;
      if (!src) return;
      globalThis.setTimeout(() => {
        void preloadImage(src, "low");
      }, orderIndex * 80);
    });
  };

  if (window.requestIdleCallback) {
    window.requestIdleCallback(scheduleDeferred, { timeout: 1200 });
  } else {
    globalThis.setTimeout(scheduleDeferred, 240);
  }

  return preloadImage(picks[order[0]]?.image, "high");
}
