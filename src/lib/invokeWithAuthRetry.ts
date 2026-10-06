import { supabase } from "@/integrations/supabase/client";

/**
 * Invoke an edge function; on 401 (stale/expired token) refresh the session and retry.
 * A concurrent refresh can leave the very next token stale too, so allow one further
 * refresh+retry cycle before surfacing the error. Callers treat { error } as non-fatal.
 */
export async function invokeWithAuthRetry<T = any>(name: string, body: unknown) {
  let result = await supabase.functions.invoke<T>(name, { body: body as any });
  for (let attempt = 0; attempt < 2; attempt++) {
    const status = (result.error as any)?.context?.status;
    if (!result.error || status !== 401) return result;
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) return result;
    result = await supabase.functions.invoke<T>(name, { body: body as any });
  }
  return result;
}
