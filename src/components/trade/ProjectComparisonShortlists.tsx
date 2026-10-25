import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "@/lib/router-compat";

export default function ProjectComparisonShortlists({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { data, isPending, isError } = useQuery({
    queryKey: ["comparator-shortlists", user?.id, projectId], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("comparator_shortlists").select("id, name, items, share_token, created_at, project_id").eq("user_id", user?.id || "").eq("project_id", projectId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return <section className="border-t border-border pt-5" aria-label="Project comparison shortlists">
    <h2 className="font-display text-lg">Comparison shortlists</h2>
    {isPending ? <p role="status" className="mt-2 text-sm text-muted-foreground">Loading shortlists…</p> : isError ? <p role="alert" className="mt-2 text-sm text-destructive">Shortlists could not be loaded.</p> : !data?.length ? <p className="mt-2 text-sm text-muted-foreground">No comparison shortlists saved yet.</p> : <ul className="mt-3 divide-y divide-border">{data.map(s => <li key={s.id} className="py-3"><Link to={`/trade/comparator?project=${projectId}&shortlist=${s.id}`} className="text-sm underline underline-offset-4">{s.name}</Link><p className="mt-1 text-xs text-muted-foreground">{Array.isArray(s.items) ? s.items.length : 0} pieces</p></li>)}</ul>}
    <Link to={`/trade/comparator?project=${projectId}`} className="mt-3 inline-block text-sm underline underline-offset-4">Open product comparator</Link>
  </section>;
}