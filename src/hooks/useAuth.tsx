import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTradeUser, setIsTradeUser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [applicationStatus, setApplicationStatus] = useState<AuthContextType["applicationStatus"]>("none");

  const fetchUserData = useCallback(async (userId: string) => {
    // Fetch roles, profile, and application status in parallel
    const [rolesRes, profileRes, appRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("first_name, last_name, company, email").eq("id", userId).single(),
      supabase.from("trade_applications").select("status").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
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

  const refreshRoles = useCallback(async () => {
    if (user) await fetchUserData(user.id);
  }, [user, fetchUserData]);

  useEffect(() => {
    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer data fetch to avoid Supabase deadlock
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        setIsTradeUser(false);
        setIsAdmin(false);
        setProfile(null);
        setApplicationStatus("none");
      }
      setLoading(false);
    });

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

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
