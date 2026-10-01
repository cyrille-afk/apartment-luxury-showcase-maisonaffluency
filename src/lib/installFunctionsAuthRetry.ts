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
  // `supabase.functions` is a getter that builds a fresh FunctionsClient on
  // every access, so the wrapper must live on the shared prototype.
  const proto = Object.getPrototypeOf(supabase.functions) as any;
  const originalInvoke = proto.invoke;
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

  proto.invoke = async function (this: any, name: string, options?: any) {
    const first = await originalInvoke.call(this, name, options);
    const status = first?.error?.context?.status;
    if (status !== 401) return first;
    // Only retry when the caller didn't pin its own Authorization header.
    const headers = options?.headers ?? {};
    const pinned = Object.keys(headers).some((k) => k.toLowerCase() === "authorization");
    if (pinned) return first;
    // A 401 with a still-valid token is a real "not allowed" answer from that
    // function — refreshing then rotates the shared refresh token for nothing
    // and can sign the member out mid-session. Only refresh genuinely stale tokens.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const exp = session?.expires_at ? session.expires_at * 1000 : 0;
      if (!session || exp - Date.now() > 60_000) return first;
    } catch { return first; }
    const ok = await refreshOnce();
    if (!ok) return first;
    // Fresh client picks up the refreshed access token.
    return originalInvoke.call(supabase.functions, name, options);
  };
}
