/**
 * Centralised product-configuration state — the "engine" behind both product
 * page layout variants.
 *
 * `ProductPageContainer` mounts this provider once and then renders either
 * `PublicEditorialLayout` (isInsideTradePortal === false) or
 * `TradePortalDashboardLayout` (isInsideTradePortal === true). Both variants
 * read and write the SAME state: active image index, upholstery finish, wood
 * finish, quantity, base retail rate and the tier discount math.
 */
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import {
  applyTradeDiscount,
  computeDisplayPrice,
  formatCents,
  type DisplayPrice,
  type PricingRole,
} from "@/lib/productPricing";

export interface ProductConfigValue {
  /** Which presentational variant is mounted. */
  isInsideTradePortal: boolean;

  // --- configuration state (shared by both variants) ---
  activeImageIndex: number;
  setActiveImageIndex: (i: number) => void;
  selectedUpholstery: string | null;
  setSelectedUpholstery: (v: string | null) => void;
  selectedWoodFinish: string | null;
  setSelectedWoodFinish: (v: string | null) => void;
  quantity: number;
  setQuantity: (q: number) => void;

  // --- pricing engine ---
  /** Base retail rate for the CURRENT selection, in minor units. */
  baseRetailPriceCents: number;
  setBaseRetailPriceCents: (cents: number) => void;
  currency: string;
  setCurrency: (c: string) => void;
  /** Real tier discount (e.g. Silver 8%) sourced from `trade_tier_config`. */
  tierDiscountPct: number;
  tierLabel: string;
  discountLabel: string;
  /** Net trade price for the current selection. */
  netPriceCents: number;
  /** Net trade price × quantity. */
  lineTotalCents: number;
  formatPrice: (cents: number) => string;
  computePrice: (role: PricingRole, withFromPrefix?: boolean) => DisplayPrice;
}

const ProductConfigContext = createContext<ProductConfigValue | null>(null);

export function ProductConfigProvider({
  isInsideTradePortal,
  children,
}: {
  isInsideTradePortal: boolean;
  children: ReactNode;
}) {
  const { discountPct, tierLabel, discountLabel } = useTradeDiscount();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedUpholstery, setSelectedUpholstery] = useState<string | null>(null);
  const [selectedWoodFinish, setSelectedWoodFinish] = useState<string | null>(null);
  const [quantity, setQuantityState] = useState(1);
  const [baseRetailPriceCents, setBaseRetailPriceCents] = useState(0);
  const [currency, setCurrency] = useState("USD");

  const setQuantity = useCallback((q: number) => {
    setQuantityState(Math.max(1, Math.min(99, Math.round(q || 1))));
  }, []);

  const value = useMemo<ProductConfigValue>(() => {
    const netPriceCents = applyTradeDiscount(baseRetailPriceCents, discountPct);
    return {
      isInsideTradePortal,
      activeImageIndex,
      setActiveImageIndex,
      selectedUpholstery,
      setSelectedUpholstery,
      selectedWoodFinish,
      setSelectedWoodFinish,
      quantity,
      setQuantity,
      baseRetailPriceCents,
      setBaseRetailPriceCents,
      currency,
      setCurrency,
      tierDiscountPct: discountPct,
      tierLabel,
      discountLabel,
      netPriceCents,
      lineTotalCents: netPriceCents * quantity,
      formatPrice: (cents: number) => formatCents(cents, currency),
      computePrice: (role, withFromPrefix = false) =>
        computeDisplayPrice(
          { baseRetailPriceCents, tradeDiscountMultiplier: discountPct },
          role,
          currency,
          withFromPrefix,
        ),
    };
  }, [
    isInsideTradePortal,
    activeImageIndex,
    selectedUpholstery,
    selectedWoodFinish,
    quantity,
    setQuantity,
    baseRetailPriceCents,
    currency,
    discountPct,
    tierLabel,
    discountLabel,
  ]);

  return (
    <ProductConfigContext.Provider value={value}>{children}</ProductConfigContext.Provider>
  );
}

/** Returns the shared engine, or null when rendered outside the container. */
export function useProductConfigOptional(): ProductConfigValue | null {
  return useContext(ProductConfigContext);
}

export function useProductConfig(): ProductConfigValue {
  const ctx = useContext(ProductConfigContext);
  if (!ctx) throw new Error("useProductConfig must be used inside ProductPageContainer");
  return ctx;
}
