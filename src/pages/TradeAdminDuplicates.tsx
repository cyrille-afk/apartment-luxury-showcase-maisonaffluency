import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTradeProducts } from "@/hooks/useTradeProducts";
import DuplicateProductsBanner from "@/components/dev/DuplicateProductsBanner";

export default function TradeAdminDuplicates() {
  const { isAdmin, loading } = useAuth();
  const { duplicateGroups } = useTradeProducts();

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet><title>Duplicate Products — Admin — Maison Affluency</title></Helmet>
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Duplicate Products</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Inspect and hide near-duplicate cards detected in the Trade catalog merge.
            Hidden items persist in this browser only and are respected across the Trade grid.
          </p>
        </div>
        <DuplicateProductsBanner groups={duplicateGroups} forceVisible />
      </div>
    </>
  );
}
