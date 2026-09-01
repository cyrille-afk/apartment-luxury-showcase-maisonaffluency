import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Mock user-role state for previewing the product page's dynamic
 * pricing / CTA transformation rules without touching auth.
 *
 * PUBLIC           — default logged-out view (retail price, Place Order)
 * RETAIL_BUYER     — standard logged-in customer (same pricing as public)
 * TRADE_UNVERIFIED — registered trade, pending review (retail price + warning)
 * TRADE_VERIFIED   — verified trade (net trade price + workspace actions)
 *
 * `overridden` stays false until the dev dropdown is used, so real
 * auth-driven behaviour is untouched until someone explicitly previews a role.
 */
export type UserRole = "PUBLIC" | "RETAIL_BUYER" | "TRADE_UNVERIFIED" | "TRADE_VERIFIED";

interface UserRoleContextValue {
  role: UserRole;
  setRole: (role: UserRole) => void;
  /** Clears the override so real auth drives the view again. */
  clearRole?: () => void;
  /** True once the dev toggle has been used — mock role then wins over real auth. */
  overridden: boolean;
}

const UserRoleContext = createContext<UserRoleContextValue>({
  role: "PUBLIC",
  setRole: () => {},
  overridden: false,
});

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>("PUBLIC");
  const [overridden, setOverridden] = useState(false);
  const setRole = (r: UserRole) => {
    setRoleState(r);
    setOverridden(true);
  };
  const clearRole = () => {
    setRoleState("PUBLIC");
    setOverridden(false);
  };
  return (
    <UserRoleContext.Provider value={{ role, setRole, clearRole, overridden }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  return useContext(UserRoleContext);
}

const ROLE_LABELS: Record<UserRole, string> = {
  PUBLIC: "Public (logged out)",
  RETAIL_BUYER: "Retail Buyer",
  TRADE_UNVERIFIED: "Trade — Unverified",
  TRADE_VERIFIED: "Trade — Verified",
};

/** Subtle fixed dev dropdown, bottom-left edge, for live role previews. */
export function DevRoleToggle() {
  const { role, setRole, clearRole, overridden } = useUserRole();
  return (
    <div className="fixed bottom-2 left-2 z-[120] flex items-center gap-2 rounded-none border border-border/60 bg-background/90 px-2.5 py-1.5 shadow-sm backdrop-blur-sm opacity-70 transition-opacity hover:opacity-100">
      <span className="font-body text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        Dev: Toggle Role
      </span>
      <select
        value={overridden ? role : "AUTO"}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "AUTO") clearRole?.();
          else setRole(v as UserRole);
        }}
        className="h-6 rounded-none border border-border/50 bg-background px-1.5 font-body text-[10px] uppercase tracking-wider text-foreground focus:outline-none"
        aria-label="Dev: toggle user role"
      >
        <option value="AUTO">Auto (real account)</option>
        {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    </div>
  );
}
