import { useEffect, type ReactNode } from "react";
import { useBlocker } from "@tanstack/react-router";
import { toast } from "sonner";
import { useLocation, useNavigate, Navigate } from "@/lib/router-compat";
import { isStudioSettingsPath, STUDIO_SETUP_PATH } from "@/lib/studioSetup";
export function remindStudioSetup() {
  toast("Felix", { id: "studio-setup-reminder", description: "Let’s finish your studio identity here before exploring your workspace." });
}
export function StudioSetupNavigationGate({ locked, ready, children }: { locked: boolean; ready: boolean; children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  useBlocker({ enableBeforeUnload: false, shouldBlockFn: ({ next }) => {
    if (!locked || !isStudioSettingsPath(location.pathname) || isStudioSettingsPath(next.pathname)) return false;
    remindStudioSetup(); return true;
  } });
  useEffect(() => {
    if (!locked) return;
    const intercept = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor) return;
      const url = new URL(anchor.getAttribute("href") || "", window.location.origin);
      if (url.origin !== window.location.origin || isStudioSettingsPath(url.pathname)) return;
      event.preventDefault(); event.stopPropagation(); remindStudioSetup();
      if (!isStudioSettingsPath(location.pathname)) navigate(STUDIO_SETUP_PATH, { replace: true });
    };
    document.addEventListener("click", intercept, true); document.addEventListener("auxclick", intercept, true);
    return () => { document.removeEventListener("click", intercept, true); document.removeEventListener("auxclick", intercept, true); };
  }, [locked, location.pathname, navigate]);
  if (!ready) return <div aria-busy="true" className="py-12 text-center text-muted-foreground">Loading studio…</div>;
  if (locked && !isStudioSettingsPath(location.pathname)) return <Navigate to={STUDIO_SETUP_PATH} replace />;
  return children;
}
