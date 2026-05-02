import { useEffect, useState } from "react";
import { History, FolderInput, FolderMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  boardId: string;
}

interface ActionRow {
  id: string;
  created_at: string;
  status: string;
  user_id: string;
  args: any;
}

interface ProfileLite {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

const formatActor = (p?: ProfileLite) => {
  if (!p) return "Unknown user";
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || "Unknown user";
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
};

export const BoardProjectHistory = ({ boardId }: Props) => {
  const [rows, setRows] = useState<ActionRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("trade_concierge_actions")
        .select("id, created_at, status, user_id, args")
        .eq("tool", "assign_tearsheet_project")
        .eq("resulting_resource_id", boardId)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error || !data) {
        setRows([]);
        setLoading(false);
        return;
      }
      setRows(data as ActionRow[]);

      const userIds = Array.from(new Set(data.map((r: any) => r.user_id).filter(Boolean)));
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name")
          .in("id", userIds);
        if (!cancelled && profs) {
          const map: Record<string, ProfileLite> = {};
          profs.forEach((p: any) => { map[p.id] = p; });
          setProfiles(map);
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [boardId]);

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <div className="mt-10 border-t border-border pt-6">
      <div className="flex items-center gap-2 mb-4">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-sm uppercase tracking-wider text-foreground">
          Project History
        </h2>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => {
          const args = (r.args || {}) as any;
          const skipped = r.status === "discarded" || args.skipped === true;
          const projectName = args.project_name || (args.project_id ? "a project" : null);
          const actor = formatActor(profiles[r.user_id]);

          return (
            <li
              key={r.id}
              className="flex items-start gap-3 p-3 rounded-md border border-border/60 bg-muted/20"
            >
              <div className="mt-0.5">
                {skipped ? (
                  <FolderMinus className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <FolderInput className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm text-foreground">
                  {skipped ? (
                    <>Skipped project assignment</>
                  ) : (
                    <>Assigned to <span className="font-medium">{projectName || "project"}</span></>
                  )}
                </p>
                <p className="font-body text-xs text-muted-foreground mt-0.5">
                  {actor} · {formatDate(r.created_at)}
                </p>
                {!skipped && args.autofilled && Object.keys(args.autofilled).length > 0 && (
                  <p className="font-body text-[11px] text-muted-foreground mt-1">
                    Auto-filled: {Object.keys(args.autofilled).join(", ")}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default BoardProjectHistory;
