import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { CuratorPick } from "@/components/FeaturedDesigners";

export type CompareItem = {
  pick: CuratorPick;
  designerName: string;
  designerId: string;
  section: "designers" | "collectibles" | "ateliers";
};

type CompareContextType = {
  items: CompareItem[];
  addItem: (item: CompareItem) => void;
  removeItem: (title: string) => void;
  clearAll: () => void;
  isComparing: boolean;
  setIsComparing: (v: boolean) => void;
  isPinned: (title: string, designerId: string) => boolean;
  togglePin: (item: CompareItem) => void;
};

const CompareContext = createContext<CompareContextType | null>(null);

const MAX_ITEMS = 3;

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  const addItem = useCallback((item: CompareItem) => {
    setItems((prev) => {
      if (prev.length >= MAX_ITEMS) return prev;
      if (prev.some((p) => p.pick.title === item.pick.title && p.designerId === item.designerId)) return prev;
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((title: string) => {
    setItems((prev) => prev.filter((p) => p.pick.title !== title));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    setIsComparing(false);
  }, []);

  const isPinned = useCallback(
    (title: string, designerId: string) => items.some((p) => p.pick.title === title && p.designerId === designerId),
    [items]
  );

  const togglePin = useCallback(
    (item: CompareItem) => {
      if (isPinned(item.pick.title, item.designerId)) {
        removeItem(item.pick.title);
      } else {
        addItem(item);
      }
    },
    [isPinned, removeItem, addItem]
  );

  return (
    <CompareContext.Provider value={{ items, addItem, removeItem, clearAll, isComparing, setIsComparing, isPinned, togglePin }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within CompareProvider");
  return ctx;
}
