import { useCallback, useState } from "react";
import { DEFAULT_BRIEF, type LayoutBrief } from "@/lib/mockAiLayoutService";

/** Single state hook for the Curated Room Layout brief (room, style, budget, dimensions). */
export function useAiLayoutForm(initial: LayoutBrief = DEFAULT_BRIEF) {
  const [brief, setBrief] = useState<LayoutBrief>(initial);
  const setField = useCallback(<K extends keyof LayoutBrief>(key: K, value: LayoutBrief[K]) => setBrief((b) => ({ ...b, [key]: value })), []);
  const setDimension = useCallback((key: keyof LayoutBrief["roomDimensions"], raw: string) => {
    const n = Math.max(3, Math.min(20, Number(raw) || 0));
    setBrief((b) => ({ ...b, roomDimensions: { ...b.roomDimensions, [key]: n } }));
  }, []);
  return { brief, setBrief, setField, setDimension };
}
