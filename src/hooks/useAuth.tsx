import { useState, useEffect, useCallback, createContext, useContext } from "react";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isTradeUser: boolean;
  isAdmin: boolean;
  profile: { first_name: string; last_name: string; company: string; email: string } | null;
  applicationStatus: "none" | "pending" | "approved" | "rejected";
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

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
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [applicationStatus, setApplicationStatus] = useState<AuthContextType["applicationStatus"]>("none");
  // Hold a reference to the dynamically-imported supabase client
  const [sbClient, setSbClient] = useState<any>(null);

  const fetchUserData = useCallback(async (userId: string, client: any) => {
    const [rolesRes, profileRes, appRes] = await Promise.all([
      client.from("user_roles").select("role").eq("user_id", userId),
      client.from("profiles").select("first_name, last_name, company, email").eq("id", userId).single(),
      client.from("trade_applications").select("status").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
    ]);

    if (rolesRes.data) {
      const roles = rolesRes.data.map((r: any) => r.role);
      setIsTradeUser(roles.includes("trade_user"));
      setIsAdmin(roles.includes("admin"));
    }

    if (profileRes.data) {
      setProfile(profileRes.data);
    }

    if (appRes.data && appRes.data.length > 0) {
      setApplicationStatus(appRes.data[0].status as any);
    } else {
      setApplicationStatus("none");
    }
  }, []);

  // Dynamically import Supabase client AFTER first paint
  useEffect(() => {
    let cancelled = false;

    // Use requestIdleCallback on homepage to avoid competing with hero LCP.
    // On trade/journal routes, load immediately since auth is needed.
    const isHomepage = window.location.pathname === "/" || window.location.pathname === "";
    
    const doImport = () => {
      import("@/integrations/supabase/client").then(mod => {
        if (!cancelled) setSbClient(mod.supabase);
      });
    };

    if (isHomepage) {
      const win = window as any;
      if (typeof win.requestIdleCallback === "function") {
        const id = win.requestIdleCallback(doImport, { timeout: 2000 });
        return () => { cancelled = true; win.cancelIdleCallback?.(id); };
      }
      const tid = setTimeout(doImport, 800);
      return () => { cancelled = true; clearTimeout(tid); };
    }

    // Non-homepage: import immediately
    doImport();
    return () => { cancelled = true; };
  }, []);

  // Once we have the supabase client, initialise auth
  useEffect(() => {
    if (!sbClient) return;

    const { data: { subscription } } = sbClient.auth.onAuthStateChange((event: string, sess: Session | null) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => fetchUserData(sess.user.id, sbClient), 0);
      } else {
        setIsTradeUser(false);
        setIsAdmin(false);
        setProfile(null);
        setApplicationStatus("none");

        if ((event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") && !sess) {
          const path = window.location.pathname;
          if (path.startsWith("/trade") && path !== "/trade/login" && path !== "/trade/register" && path !== "/trade/program") {
            window.location.href = "/trade/login";
          }
        }
      }
      setLoading(false);
    });

    sbClient.auth.getSession().then(({ data: { session: sess } }: any) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        fetchUserData(sess.user.id, sbClient);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [sbClient, fetchUserData]);

  const signOut = async () => {
    if (sbClient) await sbClient.auth.signOut();
  };

  const refreshRoles = useCallback(async () => {
    if (user && sbClient) await fetchUserData(user.id, sbClient);
  }, [user, sbClient, fetchUserData]);

  return (
    <AuthContext.Provider value={{ user, session, loading, isTradeUser, isAdmin, profile, applicationStatus, signOut, refreshRoles }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
