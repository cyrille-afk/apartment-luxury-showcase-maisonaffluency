import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProject } from "@/hooks/useProjects";
import { useCollaboratorInvite, useCollaboratorInviteDefault } from "./CollaboratorInviteProvider";

export default function QuoteWorkspaceInvite({ projectId, quoteId }: { projectId: string | null; quoteId?: string }) {
  const openInvite = useCollaboratorInvite();
  const resolveDefault = useCollaboratorInviteDefault();
  const defaultProjectId = resolveDefault ? resolveDefault(projectId) : projectId;
  const { project, loading } = useProject(defaultProjectId || undefined);
  const projectLabel = !defaultProjectId
    ? "No project linked to this quote — choose one when inviting"
    : loading ? "Project: loading…" : project?.name ? `Project: ${project.name}` : "Project unavailable — choose one when inviting";
  return <div className="flex w-full flex-col gap-1.5">
    <Button variant="outline" disabled={!openInvite} className="h-auto min-h-10 w-full cursor-pointer whitespace-normal rounded-none border-border bg-transparent px-3 py-2 font-body text-[11px] font-normal uppercase tracking-normal text-foreground hover:bg-muted" onClick={() => openInvite?.(projectId, quoteId)}>
      <UserPlus className="h-3.5 w-3.5 shrink-0" /> Add Client to Project
    </Button>
    <p className="font-body text-[11px] leading-snug text-muted-foreground" aria-live="polite">{projectLabel}</p>
  </div>;
}
