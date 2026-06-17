// Shared tenant-isolation helpers used by edge functions that operate with
// the service-role client (RLS bypassed). These checks are the ONLY thing
// preventing cross-tenant data exposure when a request reaches one of those
// functions, so they MUST be unit-tested.
//
// Each helper takes a minimal Supabase-shaped client so tests can stub it
// without a network round-trip.

export type StudioMembersClient = {
  from: (table: "studio_members") => {
    select: (cols: string) => {
      eq: (col: "studio_id", val: string) => {
        eq: (col: "user_id", val: string) => {
          maybeSingle: () => Promise<{ data: { user_id: string } | null }>;
        };
      };
    };
  };
};

/** True iff `userId` may read this project (owner OR studio member). */
export async function canAccessProject(
  supabase: StudioMembersClient,
  userId: string,
  project: { user_id: string | null; studio_id: string | null },
): Promise<boolean> {
  if (project.user_id && project.user_id === userId) return true;
  if (!project.studio_id) return false;
  const { data } = await supabase
    .from("studio_members")
    .select("user_id")
    .eq("studio_id", project.studio_id)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/**
 * True iff `userId` may attach this client to a quote.
 * - Client must have a studio_id (orphan clients are never reachable).
 * - If the quote is already bound to a project's studio, the client's studio
 *   must match it.
 * - The caller must be a member of the client's studio. We NEVER short-circuit
 *   to true when `projectStudioId` is null.
 */
export async function canAttachClientToQuote(
  supabase: StudioMembersClient,
  userId: string,
  client: { studio_id: string | null | undefined },
  projectStudioId: string | null,
): Promise<boolean> {
  const cliStudioId = client.studio_id || null;
  if (!cliStudioId) return false;
  if (projectStudioId && cliStudioId !== projectStudioId) return false;
  const { data } = await supabase
    .from("studio_members")
    .select("user_id")
    .eq("studio_id", cliStudioId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}
