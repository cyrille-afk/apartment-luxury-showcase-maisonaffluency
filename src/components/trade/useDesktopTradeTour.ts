import { useEffect, useState } from "react";

export const DESKTOP_TRADE_TOUR_QUERY = "(min-width: 768px) and (pointer: fine)";

/** Default closed until device capability is known; never mount tours on phones. */
export function useDesktopTradeTour() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_TRADE_TOUR_QUERY);
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return desktop;
}