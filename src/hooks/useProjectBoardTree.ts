import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProjectBoardLink = { id: string; project_id: string; title: string; updated_at: string; item_count?: number };

/** RLS limits these links to boards the current member can open. */
export function useProjectBoardTree(projectIds: string[]) {
  const [boards, setBoards] = useState<ProjectBoardLink[]>([]);
  const key = projectIds.join(",");
  useEffect(() => {
    if (!key) { setBoards([]); return; }
    let active = true;
    let revision = 0;
    const refresh = () => {
      const requestRevision = ++revision;
      supabase.from("client_boards").select("id, project_id, title, updated_at, client_board_items(count)")
        .in("project_id", key.split(",")).order("updated_at", { ascending: false })
        .then(({ data, error }) => {
          if (active && requestRevision === revision) setBoards(error ? [] : (data || []).flatMap(board => board.project_id ? [{ id: board.id, project_id: board.project_id, title: board.title, updated_at: board.updated_at, item_count: board.client_board_items?.[0]?.count }] : []));
        });
    };
    const onArtifactsChanged = (event: Event) => {
      const detail: unknown = event instanceof CustomEvent ? event.detail : null;
      if (detail && typeof detail === "object" && "deletedBoardId" in detail && typeof detail.deletedBoardId === "string") {
        const deletedBoardId = detail.deletedBoardId;
        setBoards(previous => previous.filter(board => board.id !== deletedBoardId));
      }
      refresh();
    };
    window.addEventListener("concierge:artifacts-changed", onArtifactsChanged);
    refresh();
    return () => {
      active = false;
      window.removeEventListener("concierge:artifacts-changed", onArtifactsChanged);
    };
  }, [key]);
  return boards;
}

export function projectDefaultUrl(projectId: string, boards: ProjectBoardLink[]) {
  const board = boards.find((item) => item.project_id === projectId);
  return board ? `/trade/boards/${board.id}?project=${projectId}` : `/trade/projects/${projectId}`;
}