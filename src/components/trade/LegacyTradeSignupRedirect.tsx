import { Navigate, useLocation } from "react-router-dom";

/** Retired /trade/apply and /trade/register URLs → unified /trade-program, keeping query pre-fill. */
export default function LegacyTradeSignupRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/trade-program${search}`} replace />;
}
