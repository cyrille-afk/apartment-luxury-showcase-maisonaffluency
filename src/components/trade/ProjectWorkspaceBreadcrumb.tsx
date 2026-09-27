import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import TradeBreadcrumb from "@/components/trade/TradeBreadcrumb";

/** Single top-of-canvas trail for project hubs and board workspaces. */
export default function ProjectWorkspaceBreadcrumb() {
  const { pathname, search } = useLocation();
  const boardId = pathname.match(/^\/trade\/boards\/([^/]+)$/)?.[1];
  const projectId = pathname.match(/^\/trade\/projects\/([^/]+)$/)?.[1];
  const [board, setBoard] = useState<{ id: string; project_id: string | null; title: string } | null>(null);
  const [project, setProject] = useState<{ id: string; name: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    setReady(false);
    setBoard(null);
    setProject(null);
    (async () => {
      const boardRow = boardId
        ? (await supabase.from("client_boards").select("id, project_id, title").eq("id", boardId).maybeSingle()).data
        : null;
      const id = boardRow?.project_id ?? projectId;
      const projectRow = id
        ? (await supabase.from("projects").select("id, name").eq("id", id).maybeSingle()).data
        : null;
      if (active) {
        setBoard(boardRow);
        setProject(projectRow);
        setReady(true);
      }
    })();
    return () => { active = false; };
  }, [boardId, projectId]);

  if (!boardId && !projectId) return null;
  if (!ready) return <div className="h-5" aria-hidden="true" />;
  const tab = new URLSearchParams(search).get("tab");
  return (
    <TradeBreadcrumb
      includeProjectsRoot
      project={project ?? undefined}
      current={boardId ? "Folders & Drafts" : tab ? ({ boards: "Folders & Drafts", quotes: "Quotes", tearsheets: "Tearsheets", shipping: "Shipping", ffe: "FF&E" }[tab] ?? undefined) : undefined}
      currentTo={boardId ? (project ? `/trade/projects/${project.id}?tab=boards` : "/trade/projects?view=folders") : tab ? `${pathname}${search}` : undefined}
      extraSegments={boardId && board ? [{ kind: "link", label: board.title, to: `/trade/boards/${board.id}${project ? `?project=${project.id}` : ""}` }] : []}
      className="mb-0"
    />
  );
}