import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";

export type Project = {
  id: string;
  user_id: string;
  studio_id: string | null;
  name: string;
  client_name: string;
  location: string;
  status: "active" | "completed" | "archived";
  color: string;
  cover_image_url: string | null;
  notes: string | null;
  target_completion_date: string | null;
  created_at: string;
  updated_at: string;
};

const RECENT_KEY = "ma:recent-projects";

export function pushRecentProject(id: string) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    const next = [id, ...arr.filter((x) => x !== id)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export function getRecentProjectIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function useProjects(opts: { activeOnly?: boolean } = {}) {
  const { user } = useAuth();
  const { currentStudio } = useStudio();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setProjects([]); setLoading(false); return; }
    setLoading(true);
    let q = supabase
      .from("projects" as any)
      .select("*")
      .order("updated_at", { ascending: false });
    // Scope to current studio so all members see studio projects.
    // RLS enforces visibility (incl. per-project overrides for hidden projects).
    if (currentStudio) {
      q = q.eq("studio_id", currentStudio.id);
    } else {
      q = q.eq("user_id", user.id);
    }
    if (opts.activeOnly) q = q.eq("status", "active");
    const { data } = await q;
    setProjects((data || []) as unknown as Project[]);
    setLoading(false);
  }, [user, currentStudio?.id, opts.activeOnly]);

  useEffect(() => { refresh(); }, [refresh]);

  return { projects, loading, refresh };
}

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) { setProject(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("projects" as any)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setProject((data as unknown as Project) || null);
    setLoading(false);
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { project, loading, refresh };
}
