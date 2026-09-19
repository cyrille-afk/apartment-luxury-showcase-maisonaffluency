import { useCallback, useEffect, useState } from "react";
import { DEFAULT_INCOTERM, type Incoterm } from "@/config/shippingZones";

const KEY = "ma_incoterm";
const EVENT = "ma:incoterm";

const read = (): Incoterm => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "DDU" || v === "DDP" ? v : DEFAULT_INCOTERM;
  } catch {
    return DEFAULT_INCOTERM;
  }
};

/**
 * Delivery term chosen by the buyer (DDP = we prepay duties and import tax,
 * DDU = the carrier invoices them at the border). Shared across every block on
 * the checkout page through a tiny storage-backed store, so the summary maths
 * and the selector always agree without prop drilling.
 */
export function useIncoterm(): [Incoterm, (next: Incoterm) => void] {
  const [incoterm, setLocal] = useState<Incoterm>(read);

  useEffect(() => {
    const sync = () => setLocal(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const set = useCallback((next: Incoterm) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode */
    }
    setLocal(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [incoterm, set];
}
