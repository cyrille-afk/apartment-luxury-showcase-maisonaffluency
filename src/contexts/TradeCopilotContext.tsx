import { createContext, useContext, useState, type ReactNode } from "react";

interface TradeCopilotContextValue {
  copilotName: string;
  setCopilotName: (name: string) => void;
}

const TradeCopilotContext = createContext<TradeCopilotContextValue | undefined>(undefined);

const STORAGE_KEY = "ma:trade-copilot-name";

export function TradeCopilotProvider({ children }: { children: ReactNode }) {
  const [copilotName, setNameState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_KEY) || "";
  });

  const setCopilotName = (name: string) => {
    const trimmed = name.trim();
    setNameState(trimmed);
    try {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      /* noop */
    }
  };

  return (
    <TradeCopilotContext.Provider value={{ copilotName, setCopilotName }}>
      {children}
    </TradeCopilotContext.Provider>
  );
}

export function useTradeCopilot(): TradeCopilotContextValue {
  const context = useContext(TradeCopilotContext);
  if (!context) {
    throw new Error("useTradeCopilot must be used within a TradeCopilotProvider");
  }
  return context;
}
