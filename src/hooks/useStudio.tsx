import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type StudioRole = "owner" | "admin" | "editor" | "viewer";

export interface Studio {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  billing_email: string | null;
  created_by: string;
}

export interface StudioMembership extends Studio {
  role: StudioRole;
}

interface StudioContextValue {
  loading: boolean;
  studios: StudioMembership[];
  currentStudio: StudioMembership | null;
  setCurrentStudioId: (id: string | null) => void;
  refresh: () => Promise<void>;
  /** Convenience role helpers based on current studio */
  isOwner: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  canView: boolean;
}

const StudioContext = createContext<StudioContextValue | undefined>(undefined);

const STORAGE_KEY = "ma_current_studio_id";

export function StudioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [studios, setStudios] = useState<StudioMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStudioId, setCurrentStudioIdState] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
  );

  const fetchStudios = useCallback(async () => {
    if (!user) {
      setStudios([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("studio_members")
      .select("role, studio:studios(id, name, slug, logo_url, billing_email, created_by)")
      .eq("user_id", user.id);

    if (error || !data) {
      setStudios([]);
      setLoading(false);
      return;
    }
    const memberships: StudioMembership[] = data
      .filter((r: any) => r.studio)
      .map((r: any) => ({ ...r.studio, role: r.role as StudioRole }));
    setStudios(memberships);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchStudios();
  }, [fetchStudios]);

  // Pick a default if none stored or stored one not in list
  useEffect(() => {
    if (loading || studios.length === 0) return;
    if (!currentStudioId || !studios.find((s) => s.id === currentStudioId)) {
      const defaultId = studios[0].id;
      setCurrentStudioIdState(defaultId);
      try { localStorage.setItem(STORAGE_KEY, defaultId); } catch {}
    }
  }, [loading, studios, currentStudioId]);

  const setCurrentStudioId = useCallback((id: string | null) => {
    setCurrentStudioIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const currentStudio = useMemo(
    () => studios.find((s) => s.id === currentStudioId) ?? null,
    [studios, currentStudioId]
  );

  const role = currentStudio?.role;
  const value: StudioContextValue = {
    loading,
    studios,
    currentStudio,
    setCurrentStudioId,
    refresh: fetchStudios,
    isOwner: role === "owner",
    isAdmin: role === "owner" || role === "admin",
    canEdit: role === "owner" || role === "admin" || role === "editor",
    canView: !!role,
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used inside StudioProvider");
  return ctx;
}
