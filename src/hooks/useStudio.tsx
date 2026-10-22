import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
// The Supabase SDK is imported on demand: pulling it in statically put ~100 KB
// of JS into the entry bundle and lengthened the first main-thread task.
const getSupabase = async () => (await import("@/integrations/supabase/client")).supabase;
import { studioSetupComplete } from "@/lib/studioSetup";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeTables } from "@/contexts/RealtimeMultiplexerContext";

export type StudioRole = "owner" | "admin" | "editor" | "viewer";

export interface Studio {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  display_name: string | null;
  primary_brand_font: string;
  default_project_markup_percentage: number;
  billing_email: string | null;
  pdf_locale: string;
  pdf_cover_theme?: unknown;
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
  isStudioSetupComplete: boolean;
  studioSetupLoading: boolean;
  projectFolderCount: number;
  refreshStudioSetup: () => Promise<void>;
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
  const [currentStudioId, setCurrentStudioIdState] = useState<string | null>(null);
  useEffect(() => { try { setCurrentStudioIdState(localStorage.getItem(STORAGE_KEY)); } catch {} }, []);
  const [projectState, setProjectState] = useState<{ studioId: string; count: number } | null>(null);

  const fetchStudios = useCallback(async (showLoading = true) => {
    if (!user) {
      setStudios([]);
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("studio_members")
       .select("role, studio:studios(id, name, slug, logo_url, display_name, primary_brand_font, default_project_markup_percentage, billing_email, pdf_locale, pdf_cover_theme, created_by)")
      .eq("user_id", user.id);

    if (error || !data) {
      setStudios([]);
      if (showLoading) setLoading(false);
      return;
    }
    const memberships: StudioMembership[] = data
      .filter((r: any) => r.studio)
      .map((r: any) => ({ ...r.studio, role: r.role as StudioRole }));
    setStudios(memberships);
    if (showLoading) setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchStudios(true);
  }, [fetchStudios]);

  // Background refresh when studio memberships change for this user
  useRealtimeTables(
    "studio_members",
    (event) => {
      const row = (event.new ?? event.old) as { user_id?: string } | null;
      if (row?.user_id && row.user_id !== user?.id) return;
      fetchStudios(false);
    },
    !!user,
  );

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

  const refreshStudioSetup = useCallback(async () => {
    if (!currentStudio || !user) return;
    const supabase = await getSupabase();
    const { count, error } = await supabase.from("projects").select("id", { count: "exact", head: true })
      .or(`studio_id.eq.${currentStudio.id},and(studio_id.is.null,user_id.eq.${user.id})`);
    if (!error) setProjectState({ studioId: currentStudio.id, count: count ?? 0 });
  }, [currentStudio?.id, user?.id]);
  useEffect(() => {
    void refreshStudioSetup();
    const changed = () => { void refreshStudioSetup(); };
    window.addEventListener("trade-projects:changed", changed);
    return () => window.removeEventListener("trade-projects:changed", changed);
  }, [refreshStudioSetup]);
  useRealtimeTables("projects", () => { void refreshStudioSetup(); }, !!user);
  useRealtimeTables("studios", () => { void fetchStudios(false); }, !!user);
  const projectFolderCount = projectState?.studioId === currentStudio?.id ? projectState?.count ?? 0 : 0;
  const role = currentStudio?.role;
  const value: StudioContextValue = {
    loading,
    studios,
    currentStudio,
    setCurrentStudioId,
    refresh: () => fetchStudios(false),
    refreshStudioSetup, projectFolderCount,
    studioSetupLoading: loading || (!!currentStudio && projectState?.studioId !== currentStudio.id),
    isStudioSetupComplete: studioSetupComplete(currentStudio, projectFolderCount),
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
