import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProjectBoardLink = { id: string; project_id: string; title: string; updated_at: string };

/** RLS limits these links to boards the current member can open. */
export function useProjectBoardTree(projectIds: string[]) {
  const [boards, setBoards] = useState<ProjectBoardLink[]>([]);
  const key = projectIds.join(",");
  useEffect(() => {
    if (!key) { setBoards([]); return; }
    let active = true;
    supabase.from("client_boards").select("id, project_id, title, updated_at")
      .in("project_id", projectIds).order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (active) setBoards(error ? [] : (data || []).filter((b): b is ProjectBoardLink => !!b.project_id));
      });
    return () => { active = false; };
  }, [key]);
  return boards;
}

export function projectDefaultUrl(projectId: string, boards: ProjectBoardLink[]) {
  const board = boards.find((item) => item.project_id === projectId);
  return board ? `/trade/boards/${board.id}?project=${projectId}` : `/trade/projects/${projectId}`;
}