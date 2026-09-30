import { supabase } from "@/integrations/supabase/client";

/** Invoke an edge function; on 401 (stale token) refresh the session and retry once. */
export async function invokeWithAuthRetry<T = any>(name: string, body: unknown) {
  const first = await supabase.functions.invoke<T>(name, { body: body as any });
  const status = (first.error as any)?.context?.status;
  if (!first.error || status !== 401) return first;
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) return first;
  return supabase.functions.invoke<T>(name, { body: body as any });
}
