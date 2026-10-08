import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/** Admin-only gate: waits for role lookup before deciding, so a pending lookup never redirects an admin. */
export default function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin, rolesLoaded } = useAuth() as { isAdmin: boolean; rolesLoaded: boolean };
  if (!rolesLoaded) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;
  return <>{children}</>;
}
