import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";

/**
 * Pretty, branded acknowledgement URL used in designer PO emails:
 *   /api/procurement/acknowledge/:poId?token=<acknowledgment_token>
 * Hands off to the secure edge-function endpoint which records the
 * acknowledgement and renders the confirmation page.
 */
const PoAcknowledge = () => {
  const { poId } = useParams<{ poId: string }>();
  const [params] = useSearchParams();

  useEffect(() => {
    const token = params.get("token") ?? "";
    const base = import.meta.env.VITE_SUPABASE_URL as string;
    const target = `${base}/functions/v1/acknowledge-purchase-order/${poId ?? ""}?token=${encodeURIComponent(token)}`;
    window.location.replace(target);
  }, [poId, params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground tracking-wide">Confirming receipt of your purchase order…</p>
    </div>
  );
};

export default PoAcknowledge;
