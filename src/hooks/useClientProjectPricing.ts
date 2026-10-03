import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStudio } from "@/hooks/useStudio";
import { effectiveProjectMultiplier } from "@/lib/tradePricing";

/** Resolves the selected project's markup; never reads prices from browser storage. */
export function useClientProjectPricing() {
  const { currentStudio } = useStudio();
  const [override, setOverride] = useState<unknown>(null);
  const [projectId, setProjectId] = useState<string | null>(() => {
    try { return sessionStorage.getItem("trade:lastProjectFilter"); } catch { return null; }
  });

  useEffect(() => {
    const sync = () => {
      try { setProjectId(sessionStorage.getItem("trade:lastProjectFilter")); } catch { setProjectId(null); }
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("trade:project-filter-change", sync);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("trade:project-filter-change", sync); };
  }, []);
  useEffect(() => {
    let active = true;
    setOverride(null);
    if (projectId) {
      supabase.from("projects").select("trade_multiplier").eq("id", projectId).maybeSingle()
        .then(({ data }) => { if (active) setOverride(data?.trade_multiplier ?? null); });
    }
    return () => { active = false; };
  }, [projectId, currentStudio?.id]);
  return effectiveProjectMultiplier(override, currentStudio?.default_project_markup_percentage);
}