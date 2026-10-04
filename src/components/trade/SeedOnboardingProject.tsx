import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { useProjects } from "@/hooks/useProjects";
import { useTierVolumeLocale } from "@/hooks/useTierVolumeLocale";
import { onboardingProjectForMarket } from "@/lib/onboardingProject";
import { supabase } from "@/integrations/supabase/client";

/** Mount in the trade shell so the project exists even before Step 4 opens Projects. */
export default function SeedOnboardingProject() {
  const { user, isTradeUser, isAdmin, rolesLoaded } = useAuth();
  const { currentStudio, loading: studioLoading, canEdit } = useStudio();
  const { projects, loading } = useProjects();
  const { market, marketLoading } = useTierVolumeLocale();

  useEffect(() => {
    if (!user || !rolesLoaded || studioLoading || loading || marketLoading || !(currentStudio ? canEdit : isTradeUser || isAdmin)) return;
    // A starter folder is for onboarding, not a replacement for a project an
    // established member intentionally removed.
    if (localStorage.getItem("felix_dashboard_tour_seen_v1") || localStorage.getItem("trade_quick_tour_done")) return;
    const key = `ma:onboarding-project:v1:${user.id}:${currentStudio?.id ?? "personal"}`;
    try {
      if (projects.length) { localStorage.setItem(key, "done"); return; }
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "pending");
    } catch { return; }

    (async () => {
      let query = supabase.from("projects").select("id").limit(1);
      query = currentStudio ? query.eq("studio_id", currentStudio.id) : query.eq("user_id", user.id).is("studio_id", null);
      const [{ data: existing, error: readError }, hidden] = await Promise.all([
        query,
        currentStudio ? supabase.from("studio_project_overrides").select("project_id, projects!inner(studio_id)")
          .eq("user_id", user.id).is("role", null).eq("projects.studio_id", currentStudio.id).limit(1) : Promise.resolve({ data: [] }),
      ]);
      if (readError || ("error" in hidden && hidden.error) || hidden.data?.length || existing?.length) {
        try { if (existing?.length || hidden.data?.length) localStorage.setItem(key, "done"); else localStorage.removeItem(key); } catch { /* optional storage */ }
        return;
      }
      const sample = onboardingProjectForMarket(market);
      const { error } = await supabase.from("projects").insert({
        user_id: user.id, studio_id: currentStudio?.id ?? null,
        name: sample.name, location: sample.location,
      });
      try { if (error) localStorage.removeItem(key); else localStorage.setItem(key, "done"); } catch { /* optional storage */ }
      if (!error) window.dispatchEvent(new Event("trade-projects:changed"));
    })();
  }, [user?.id, rolesLoaded, isTradeUser, isAdmin, studioLoading, loading, marketLoading, canEdit, currentStudio?.id, market, projects.length]);
  return null;
}