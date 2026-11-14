import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { ProjectPicker } from '@/components/trade/ProjectPicker';
import ToolsBreadcrumb from '@/components/trade/ToolsBreadcrumb';
import { LayoutTemplate } from 'lucide-react';

export const Route = createFileRoute('/trade/project-studio')({
  head: () => ({ meta: [
    { title: 'Choose Project Studio | Maison Affluency Trade' },
    { name: 'description', content: 'Choose a project to curate its composition, lock material finishes and review specifications in Project Studio.' },
    { property: 'og:title', content: 'Choose Project Studio | Maison Affluency Trade' },
    { property: 'og:description', content: 'Open your project’s visual composition, finish selections and live specification pricing.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: ProjectStudioChooser,
});
function ProjectStudioChooser() {
  const [projectId, setProjectId] = useState<string | null>(null);
  return <div className="mx-auto max-w-6xl space-y-6">
    <ToolsBreadcrumb />
    <h1 className="font-display text-3xl text-foreground">Project Studio</h1>
    <div className="flex flex-wrap items-center gap-3">
      <ProjectPicker value={projectId} onChange={setProjectId} required />
      {projectId && <Button asChild variant="studio-primary"><Link to={`/trade/projects/${encodeURIComponent(projectId)}/studio`}><LayoutTemplate className="size-4" />Open Project Studio</Link></Button>}
    </div>
  </div>;
}