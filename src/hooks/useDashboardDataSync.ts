import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { parseProjectStagingMessage, type ProjectStagingPayload } from "@/lib/projectStagingMessage";

interface DashboardDataSyncOptions {
  onVerified?: (payload: ProjectStagingPayload) => void;
  successMessage?: string | ((payload: ProjectStagingPayload) => string);
  showToast?: boolean;
}

/** Receives same-origin sidebar notifications and reconciles them with RLS-visible saved items. */
export function useDashboardDataSync(options: DashboardDataSyncOptions = {}) {
  const { user } = useAuth();
  const { currentStudio } = useStudio();
  const [itemsByProject, setItemsByProject] = useState<Record<string, ProjectStagingPayload[]>>({});
  const onVerifiedRef = useRef(options.onVerified);
  const successMessageRef = useRef(options.successMessage);

  onVerifiedRef.current = options.onVerified;
  successMessageRef.current = options.successMessage;

  useEffect(() => {
    setItemsByProject({});
    if (!user) return;
    let mounted = true;
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !event.source || event.source === window) return;
      // Only the dedicated same-origin trade sidebar may notify this dashboard.
      try {
        if ((event.source as Window).location.pathname !== "/trade/concierge/sidebar") return;
      } catch { return; }
      const payload = parseProjectStagingMessage(event.data);
      if (!payload) return;

      const { data: project, error: projectError } = await supabase.from("projects")
        .select("id, name, studio_id, user_id").eq("id", payload.projectId).maybeSingle();
      if (projectError || !project || project.name !== payload.targetWorkflow ||
        (currentStudio ? project.studio_id !== currentStudio.id : project.studio_id !== null || project.user_id !== user.id)) return;
      const { data: item, error: itemError } = await supabase.from("client_board_items")
        .select("id, product_id, client_boards!inner(project_id)")
        .eq("id", payload.boardItemId).eq("product_id", payload.productId)
        .eq("client_boards.project_id", payload.projectId).maybeSingle();
      if (itemError || !item) return;
      const { data: product, error: productError } = await supabase.from("trade_products")
        .select("product_name, brand_name").eq("id", payload.productId).maybeSingle();
      if (productError || !product) return;
      if (!mounted) return;
      const verified = { ...payload, productName: product.product_name, designer: product.brand_name };
      setItemsByProject((previous) => {
        const list = previous[payload.projectId] ?? [];
        if (list.some((entry) => entry.boardItemId === payload.boardItemId)) return previous;
        return { ...previous, [payload.projectId]: [...list, verified] };
      });
      window.dispatchEvent(new Event("concierge:artifacts-changed"));
      onVerifiedRef.current?.(verified);
      if (options.showToast !== false) {
        const message = successMessageRef.current;
        toast.success(typeof message === "function"
          ? message(verified)
          : message || "Database Sync Complete: Project records refreshed via Trade Concierge Extension.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => { mounted = false; window.removeEventListener("message", onMessage); };
  }, [user?.id, currentStudio?.id, options.showToast]);

  return itemsByProject;
}