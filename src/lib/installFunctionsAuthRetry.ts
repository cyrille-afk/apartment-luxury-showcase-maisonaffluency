import { supabase } from "@/integrations/supabase/client";

/**
 * App-wide guard for stale sign-in tokens on edge-function calls.
 * Any `supabase.functions.invoke` that comes back 401 refreshes the session
 * once and retries, so an expired token after sleep/tab focus never surfaces
 * as an "Unauthorized" failure (or a blank screen) in any of the ~120 callers.
 */
let installed = false;

export function installFunctionsAuthRetry() {
  if (installed) return;
  installed = true;
  const fns = supabase.functions as any;
  const original = fns.invoke.bind(fns);
  let refreshing: Promise<boolean> | null = null;

  const refreshOnce = () => {
    if (!refreshing) {
      refreshing = supabase.auth
        .refreshSession()
        .then(({ data, error }) => !error && !!data.session)
        .catch(() => false)
        .finally(() => {
          setTimeout(() => { refreshing = null; }, 2000);
        });
    }
    return refreshing;
  };

  fns.invoke = async (name: string, options?: any) => {
    const first = await original(name, options);
    const status = first?.error?.context?.status;
    if (status !== 401) return first;
    // Only retry when the caller didn't pin its own Authorization header.
    const headers = options?.headers ?? {};
    const pinned = Object.keys(headers).some((k) => k.toLowerCase() === "authorization");
    if (pinned) return first;
    const ok = await refreshOnce();
    if (!ok) return first;
    return original(name, options);
  };
}
