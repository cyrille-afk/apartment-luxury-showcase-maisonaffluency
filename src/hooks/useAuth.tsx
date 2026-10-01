import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isTradeUser: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  profile: { first_name: string; last_name: string; company: string; email: string; trade_status?: string | null; has_seen_trade_intro?: boolean | null; concierge_name?: string | null } | null;
  /** Vetting state from public.profiles.trade_status: approved | pending_review | rejected */
  tradeStatus: "approved" | "pending_review" | "rejected" | null;
  applicationStatus: "none" | "pending" | "approved" | "rejected";
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function isPreviewOrDev(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return host.includes("lovableproject.com") || host.includes("lovable.app") || host.includes("id-preview--");
}

/**
 * AuthProvider defers its Supabase SDK import so it doesn't add to the
 * critical-path bundle. On first render it provides safe defaults; once
 * the dynamic import resolves it initialises auth normally.
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTradeUser, setIsTradeUser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [applicationStatus, setApplicationStatus] = useState<AuthContextType["applicationStatus"]>("none");
  const [tradeStatus, setTradeStatus] = useState<AuthContextType["tradeStatus"]>(null);
  // Hold a reference to the dynamically-imported supabase client
  const [sbClient, setSbClient] = useState<any>(null);
  // Live mirror of the signed-in user id for the (once-registered) auth
  // listener — its closure would otherwise capture a stale `user`.
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  // Retries the role/profile lookup with backoff so a single dropped request
  // can never demote a signed-in admin/trade user to public-only view.
  const MAX_LOOKUP_ATTEMPTS = 4;
  const lookupRetryTimerRef = useRef<number | null>(null);

  const fetchUserData = useCallback(async (userId: string, client: any, attempt = 0): Promise<boolean> => {
    let rolesRes: any;
    let profileRes: any;
    let appRes: any;
    let lookupError: any = null;

    try {
      [rolesRes, profileRes, appRes] = await Promise.all([
        client.from("user_roles").select("role").eq("user_id", userId),
        client.from("profiles").select("first_name, last_name, company, email, trade_status, has_seen_trade_intro, concierge_name").eq("id", userId).single(),
        client.from("trade_accounts").select("status").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
      ]);
    } catch (error) {
      lookupError = error;
    }

    // A missing profile row is legitimate (PGRST116); anything else on any of
    // the three lookups is treated as a transient failure worth retrying.
    if (!lookupError) {
      const profileLookupFailed = profileRes.error && profileRes.error.code !== "PGRST116";
      if (rolesRes.error || appRes.error || profileLookupFailed) {
        lookupError = rolesRes.error || appRes.error || profileRes.error;
      }
    }

    if (lookupError) {
      if (attempt + 1 < MAX_LOOKUP_ATTEMPTS) {
        // Exponential backoff: 500ms → 1s → 2s, then one delayed retry below.
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        return fetchUserData(userId, client, attempt + 1);
      }
      console.warn("Role lookup failed after retries; keeping existing permissions.", lookupError);
      // Last-resort background retry for a flaky connection at page load —
      // without it an admin would stay stuck in public-only mode all session.
      if (lookupRetryTimerRef.current) window.clearTimeout(lookupRetryTimerRef.current);
      lookupRetryTimerRef.current = window.setTimeout(() => {
        if (userIdRef.current === userId) void fetchUserData(userId, client);
      }, 8000);
      return false;
    }

    if (rolesRes.data) {
      const roles = rolesRes.data.map((r: any) => r.role);
      setIsTradeUser(roles.includes("trade_user"));
      setIsSuperAdmin(roles.includes("super_admin"));
      setIsAdmin(roles.includes("admin") || roles.includes("super_admin"));
    }

    if (profileRes.data) {
      setProfile(profileRes.data);
      setTradeStatus((profileRes.data.trade_status as AuthContextType["tradeStatus"]) ?? null);
    }

    if (appRes.data && appRes.data.length > 0) {
      { const s = appRes.data[0].status; setApplicationStatus((s === "pending_review" || s === "on_hold" ? "pending" : s) as any); }
    } else {
      setApplicationStatus("none");
    }

    return true;
  }, []);

  // Dynamically import Supabase client AFTER first paint.
  // We used to defer 12s on the homepage to protect LCP, but that made hard
  // refreshes look signed-out for 12 seconds. Now we kick the import on the
  // next idle tick (or microtask fallback) so it runs right after paint
  // without blocking the critical path.
  useEffect(() => {
    let cancelled = false;

    const doImport = () => {
      import("@/integrations/supabase/client").then(mod => {
        if (!cancelled) setSbClient(mod.supabase);
      });
    };

    const win = window as any;
    let idleId: number | null = null;
    let rafId: number | null = null;

    const schedule = () => {
      if (typeof win.requestIdleCallback === "function") {
        idleId = win.requestIdleCallback(doImport, { timeout: 500 });
      } else {
        rafId = window.requestAnimationFrame(() => doImport());
      }
    };

    // Run after the first paint so we don't compete with hero LCP, but
    // without an arbitrary multi-second delay.
    if (document.readyState === "complete" || document.readyState === "interactive") {
      schedule();
    } else {
      window.addEventListener("DOMContentLoaded", schedule, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("DOMContentLoaded", schedule);
      if (idleId !== null) win.cancelIdleCallback?.(idleId);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);


  // Once we have the supabase client, initialise auth
  useEffect(() => {
    if (!sbClient) return;

    // 1. Restore session from storage FIRST — this prevents the race where
    //    onAuthStateChange fires INITIAL_SESSION with null before the token
    //    is read from localStorage.
    let refreshTimer: number | null = null;

    const scheduleTokenRefresh = (sess: Session | null) => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = null;
      if (!sess?.expires_at) return;

      // Belt-and-suspenders: Supabase's own autoRefreshToken handles this,
      // but we also schedule a manual refresh 2 minutes before expiry so
      // a backgrounded tab can't get stuck on an expired access token.
      const refreshInMs = Math.max((sess.expires_at * 1000) - Date.now() - 120_000, 30_000);
      refreshTimer = window.setTimeout(() => {
        void (async () => {
          try {
            // Another consumer (another tab or autoRefreshToken) may have
            // already rotated the refresh token — refreshing a consumed
            // token poisons the stored session ("refresh_token_already_used").
            // Only refresh when the session is genuinely near expiry.
            const { data: { session: current } }: any = await sbClient.auth.getSession();
            if (!current?.expires_at) return;
            if (current.expires_at * 1000 - Date.now() > 60_000) {
              scheduleTokenRefresh(current);
              return;
            }
            const { error } = await sbClient.auth.refreshSession();
            if (error) throw error;
          } catch (error: any) {
            const message = String(error?.message ?? error ?? "");
            if (/refresh_token|already used|invalid|expired/i.test(message)) {
              // Another tab/preview surface may have rotated the token already
              // and stored a valid session — keep it instead of signing out.
              try {
                const { data: { session: latest } }: any = await sbClient.auth.getSession();
                if (latest?.expires_at && latest.expires_at * 1000 - Date.now() > 60_000) {
                  scheduleTokenRefresh(latest);
                  return;
                }
              } catch { /* fall through */ }
              // The refresh token is definitively dead — purge it so the
              // app cleanly falls back to anon (SIGNED_OUT) instead of
              // retrying a consumed token and spraying 401s at edge calls.
              await sbClient.auth.signOut().catch(() => {});
              return;
            }
            console.warn("Unable to refresh auth session; keeping current auth state.", error);
            scheduleTokenRefresh(sbClient.auth.session());
          }
        })();
      }, refreshInMs);
    };

    const restoreSession = async () => {
      let resolved: Session | null = null;
      try {
        const { data: { session: sess } }: any = await sbClient.auth.getSession();
        resolved = sess || (await sbClient.auth.refreshSession()).data?.session || null;
      } catch (error) {
        console.warn("Unable to refresh auth session; keeping current auth state.", error);
        setLoading(false);
        return;
      }
      setSession(resolved);
      setUser(resolved?.user ?? null);
      userIdRef.current = resolved?.user?.id ?? null;
      scheduleTokenRefresh(resolved);
      if (resolved?.user) {
        // Await so role/profile/application state is populated BEFORE
        // gates like TradeLayout flip on `loading=false`. Otherwise a
        // super_admin briefly looks like a public user and gets bounced
        // to /trade/me?restricted=1.
        await fetchUserData(resolved.user.id, sbClient);
        const oauthReturnPath = sessionStorage.getItem("maison:oauth-return-path");
        if (oauthReturnPath === "/trade") {
          sessionStorage.removeItem("maison:oauth-return-path");
          const p = window.location.pathname;
          // Only redirect from the landing/sign-in screens — never yank a
          // member out of a portal section they just opened.
          if (p === "/" || p.startsWith("/trade/login")) {
            window.location.replace(oauthReturnPath);
            return;
          }
        }
      }
      setLoading(false);
    };

    restoreSession();

    // 2. THEN subscribe to future changes (sign-in, sign-out, token refresh).
    //    We deliberately skip the INITIAL_SESSION event since getSession above
    //    already handled it.
    const { data: { subscription } } = sbClient.auth.onAuthStateChange((event: string, sess: Session | null) => {
      if (event === "INITIAL_SESSION") return; // already handled above

      if (!sess && event !== "SIGNED_OUT") {
        console.warn("Ignoring transient empty auth session event; keeping current auth state.", event);
        setLoading(false);
        return;
      }

      setSession(sess);
      setUser(sess?.user ?? null);
      scheduleTokenRefresh(sess);
      if (sess?.user) {
        const sameUser = userIdRef.current === sess.user.id;
        // Only re-hydrate roles on an actual sign-in. TOKEN_REFRESHED fires
        // periodically (and on tab focus) — flipping `loading` there causes
        // gated routes (like the designer editor) to unmount mid-edit.
        if (event === "SIGNED_IN") {
          // Supabase also fires SIGNED_IN (not just TOKEN_REFRESHED) when
          // another tab adopts/refreshes the shared session. If it's the same
          // user, re-hydrate silently — flipping `loading` here unmounts
          // gated routes (like the designer editor) mid-edit.
          if (sameUser) {
            void fetchUserData(sess.user.id, sbClient);
            setLoading(false);
            return;
          }
          // Session elevation (e.g. Trade Program login) must never isolate or
          // discard the basket built while signed out — merge it forward.
          import("@/lib/cart")
            .then((m) => m.mergeGuestCartIntoSession())
            .catch(() => {
              /* basket merge is best-effort */
            });
          setLoading(true);
          setTimeout(async () => {
            userIdRef.current = sess.user.id;
            await fetchUserData(sess.user.id, sbClient);
            setLoading(false);
            // Google sign-in lands back on the site root; honour the
            // destination the sign-in page asked for.
            try {
              const returnPath = sessionStorage.getItem("maison:oauth-return-path");
              if (returnPath === "/trade") {
                sessionStorage.removeItem("maison:oauth-return-path");
                const p = window.location.pathname;
                const alreadyInPortal = p.startsWith("/trade") && !p.startsWith("/trade/login");
                if (!alreadyInPortal) {
                  window.location.replace(returnPath);
                }
              }
            } catch { /* noop */ }
          }, 0);
          return;
        }
        setLoading(false);
        return;
      } else {
        setIsTradeUser(false);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setProfile(null);
        setTradeStatus(null);
        setApplicationStatus("none");

        if (event === "SIGNED_OUT") {
          const path = window.location.pathname;
          if (path.startsWith("/trade") && path !== "/trade/login" && path !== "/trade-program") {
            window.location.href = "/trade/login";
          }
        }
      }
      setLoading(false);
    });

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      if (lookupRetryTimerRef.current) window.clearTimeout(lookupRetryTimerRef.current);
      subscription.unsubscribe();
    };
  }, [sbClient, fetchUserData]);

  const signOut = async () => {
    if (sbClient) await sbClient.auth.signOut();
  };

  const refreshRoles = useCallback(async () => {
    if (user && sbClient) await fetchUserData(user.id, sbClient);
  }, [user, sbClient, fetchUserData]);

  return (
    <AuthContext.Provider value={{ user, session, loading, isTradeUser, isAdmin, isSuperAdmin, profile, tradeStatus, applicationStatus, signOut, refreshRoles }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
