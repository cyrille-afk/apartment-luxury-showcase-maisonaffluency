import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { useProjects } from "@/hooks/useProjects";
import { useTierVolumeLocale } from "@/hooks/useTierVolumeLocale";
import { onboardingProjectForMarket } from "@/lib/onboardingProject";
import { supabase } from "@/integrations/supabase/client";

/** Mount in the trade shell so the project exists even before Step 4 opens Projects. */
export default function SeedOnboardingProject() {
  const { user } = useAuth();
  const { currentStudio, loading: studioLoading, canEdit } = useStudio();
  const { projects, loading } = useProjects();
  const { market, marketLoading } = useTierVolumeLocale();

  useEffect(() => {
    if (!user || studioLoading || loading || marketLoading || !canEdit) return;
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
        currentStudio ? supabase.from("studio_project_overrides").select("project_id")
          .eq("user_id", user.id).is("role", null).eq("projects.studio_id", currentStudio.id).limit(1) : Promise.resolve({ data: [] }),
      ]);
      if (readError || hidden.data?.length || existing?.length) {
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
  }, [user?.id, studioLoading, loading, marketLoading, canEdit, currentStudio?.id, market, projects.length]);
  return null;
}