import { useState, useEffect, useCallback, createContext, useContext } from "react";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isTradeUser: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  profile: { first_name: string; last_name: string; company: string; email: string } | null;
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
  // Hold a reference to the dynamically-imported supabase client
  const [sbClient, setSbClient] = useState<any>(null);

  const fetchUserData = useCallback(async (userId: string, client: any) => {
    let rolesRes: any;
    let profileRes: any;
    let appRes: any;

    try {
      [rolesRes, profileRes, appRes] = await Promise.all([
        client.from("user_roles").select("role").eq("user_id", userId),
        client.from("profiles").select("first_name, last_name, company, email").eq("id", userId).single(),
        client.from("trade_applications").select("status").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
      ]);
    } catch (error) {
      console.warn("Unable to refresh trade access state; keeping existing permissions.", error);
      return false;
    }

    if (rolesRes.error || appRes.error) {
      console.warn("Unable to refresh trade access state; keeping existing permissions.", rolesRes.error || appRes.error);
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
    }

    if (appRes.data && appRes.data.length > 0) {
      setApplicationStatus(appRes.data[0].status as any);
    } else {
      setApplicationStatus("none");
    }

    return true;
  }, []);

  // Dynamically import Supabase client AFTER first paint
  useEffect(() => {
    let cancelled = false;

    // Use requestIdleCallback on homepage to avoid competing with hero LCP.
    // On trade/journal routes, load immediately since auth is needed.
    const isHomepage = window.location.pathname === "/" || window.location.pathname === "";
    
    const doImport = () => {
      import("@/integrations/supabase/client").then(mod => {
        if (!cancelled) {
          setSbClient(mod.supabase);
        }
      });
    };

    if (isHomepage) {
      const win = window as any;
      let idleId: number | null = null;
      let timeoutId: number | null = null;
      let loadFallbackId: number | null = null;
      let started = false;

      const start = () => {
        if (started) return;
        started = true;
        timeoutId = window.setTimeout(() => {
          if (typeof win.requestIdleCallback === "function") {
            idleId = win.requestIdleCallback(doImport, { timeout: 3000 });
          } else {
            doImport();
          }
        }, 12000);
      };

      if (document.readyState === "complete") {
        start();
      } else {
        window.addEventListener("load", start, { once: true });
        loadFallbackId = window.setTimeout(start, 12000);
      }

      return () => {
        cancelled = true;
        window.removeEventListener("load", start);
        if (timeoutId) window.clearTimeout(timeoutId);
        if (loadFallbackId) window.clearTimeout(loadFallbackId);
        if (idleId !== null) win.cancelIdleCallback?.(idleId);
      };
    }

    // Non-homepage: import immediately
    doImport();
    return () => { cancelled = true; };
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
      if (isPreviewOrDev()) return;
      if (!sess?.expires_at) return;

      const refreshInMs = Math.max((sess.expires_at * 1000) - Date.now() - 120_000, 30_000);
      refreshTimer = window.setTimeout(() => {
        sbClient.auth.refreshSession().catch((error: unknown) => {
          console.warn("Unable to refresh auth session; keeping current auth state.", error);
        });
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
      scheduleTokenRefresh(resolved);
      if (resolved?.user) {
        // Await so role/profile/application state is populated BEFORE
        // gates like TradeLayout flip on `loading=false`. Otherwise a
        // super_admin briefly looks like a public user and gets bounced
        // to /trade/me?restricted=1.
        await fetchUserData(resolved.user.id, sbClient);
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
        // Only re-hydrate roles on an actual sign-in. TOKEN_REFRESHED fires
        // periodically (and on tab focus) — flipping `loading` there causes
        // gated routes (like the designer editor) to unmount mid-edit.
        if (event === "SIGNED_IN") {
          setLoading(true);
          setTimeout(async () => {
            await fetchUserData(sess.user.id, sbClient);
            setLoading(false);
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
        setApplicationStatus("none");

        if (event === "SIGNED_OUT") {
          const path = window.location.pathname;
          if (path.startsWith("/trade") && path !== "/trade/login" && path !== "/trade/register" && path !== "/trade-program") {
            window.location.href = "/trade/login";
          }
        }
      }
      setLoading(false);
    });

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
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
    <AuthContext.Provider value={{ user, session, loading, isTradeUser, isAdmin, isSuperAdmin, profile, applicationStatus, signOut, refreshRoles }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
