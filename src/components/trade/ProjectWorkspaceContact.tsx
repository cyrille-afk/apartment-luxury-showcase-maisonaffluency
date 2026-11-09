import { useProjectWorkspace } from "@/contexts/ProjectWorkspaceContext";

export default function ProjectWorkspaceContact({ projectId, folderId }: { projectId: string; folderId?: string }) {
  const workspace = useProjectWorkspace();
  const project = workspace?.projects[projectId];
  const contact = folderId ? project?.folders[folderId]?.primaryContact : project?.primaryContact;
  if (!contact) return null;
  return <p aria-live="polite" className="mb-2 break-all font-body text-xs text-muted-foreground"><span>Client workspace owner</span> · {contact}</p>;
}