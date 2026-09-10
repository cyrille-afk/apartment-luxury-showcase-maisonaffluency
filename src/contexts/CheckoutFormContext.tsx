import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getCurrentDestination,
  isManualDestination,
  setDestination,
} from "@/lib/shippingDestination";

/**
 * Global checkout form state.
 *
 * The identity gateway (/cart/identify) collects the buyer's email first; the
 * payment stages (/checkout — contact, shipping, billing, review) must never
 * ask for it again. This slice keeps the value alive across route changes and
 * OAuth redirects (sessionStorage) so the email travels from the first input
 * all the way into the final purchase payload.
 */

export type BuyerProfile = "designer" | "private" | null;

export type CheckoutFormState = {
  email: string;
  guestName: string;
  /** City the project is located in ("Singapore"), from the intent funnel. */
  projectCity: string;
  /** ISO-3166 alpha-2 of the project / delivery country. */
  projectCountry: string;
  /** Studio (designer / architect) vs private client. */
  buyerProfile: BuyerProfile;
};

type CheckoutFormContextValue = CheckoutFormState & {
  setEmail: (email: string) => void;
  setGuestName: (name: string) => void;
  setProjectCity: (city: string) => void;
  setProjectCountry: (iso: string) => void;
  setBuyerProfile: (profile: BuyerProfile) => void;
  update: (patch: Partial<CheckoutFormState>) => void;
  reset: () => void;
};

const STORAGE_KEY = "ma_checkout_form";

const EMPTY: CheckoutFormState = {
  email: "",
  guestName: "",
  projectCity: "",
  projectCountry: "",
  buyerProfile: null,
};

function parse(raw: string | null): CheckoutFormState {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw);
    return {
      email: typeof parsed.email === "string" ? parsed.email : "",
      guestName: typeof parsed.guestName === "string" ? parsed.guestName : "",
      projectCity: typeof parsed.projectCity === "string" ? parsed.projectCity : "",
      projectCountry:
        typeof parsed.projectCountry === "string"
          ? parsed.projectCountry.toUpperCase()
          : "",
      buyerProfile:
        parsed.buyerProfile === "designer" || parsed.buyerProfile === "private"
          ? parsed.buyerProfile
          : null,
    };
  } catch {
    return EMPTY;
  }
}

function load(): CheckoutFormState {
  try {
    // sessionStorage first (current tab), localStorage as the durable
    // fallback so a direct visit or a new tab still pre-fills the email.
    const session = parse(sessionStorage.getItem(STORAGE_KEY));
    const durable = parse(localStorage.getItem(STORAGE_KEY));
    // The project location is deliberately sticky across tabs and sessions:
    // once stated, the shopper never specifies their country twice.
    return {
      email: session.email || durable.email,
      guestName: session.guestName || durable.guestName,
      projectCity: session.projectCity || durable.projectCity,
      projectCountry: session.projectCountry || durable.projectCountry,
      buyerProfile: session.buyerProfile ?? durable.buyerProfile,
    };
  } catch {
    return EMPTY;
  }
}

function persist(state: CheckoutFormState) {
  try {
    const empty =
      !state.email &&
      !state.guestName &&
      !state.projectCity &&
      !state.projectCountry &&
      !state.buyerProfile;
    if (empty) {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } else {
      const raw = JSON.stringify(state);
      sessionStorage.setItem(STORAGE_KEY, raw);
      localStorage.setItem(STORAGE_KEY, raw);
    }
  } catch {
    /* private mode — in-memory state still works */
  }
}

const CheckoutFormContext = createContext<CheckoutFormContextValue | null>(null);

export function CheckoutFormProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CheckoutFormState>(load);

  // A project country stated earlier in the funnel re-arms the header flag /
  // settlement currency on the next visit, so the shopper never restates it.
  useEffect(() => {
    const iso = state.projectCountry;
    if (!iso) return;
    if (isManualDestination()) return;
    if (getCurrentDestination()?.iso === iso) return;
    setDestination(iso);
  }, [state.projectCountry]);

  const update = useCallback((patch: Partial<CheckoutFormState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  const setEmail = useCallback((email: string) => update({ email }), [update]);
  const setGuestName = useCallback(
    (guestName: string) => update({ guestName }),
    [update],
  );
  const setProjectCity = useCallback(
    (projectCity: string) => update({ projectCity }),
    [update],
  );
  const setProjectCountry = useCallback(
    (iso: string) => update({ projectCountry: (iso || "").toUpperCase() }),
    [update],
  );
  const setBuyerProfile = useCallback(
    (buyerProfile: BuyerProfile) => update({ buyerProfile }),
    [update],
  );
  const reset = useCallback(() => {
    persist(EMPTY);
    setState(EMPTY);
  }, []);

  const value = useMemo<CheckoutFormContextValue>(
    () => ({
      ...state,
      setEmail,
      setGuestName,
      setProjectCity,
      setProjectCountry,
      setBuyerProfile,
      update,
      reset,
    }),
    [state, setEmail, setGuestName, setProjectCity, setProjectCountry, setBuyerProfile, update, reset],
  );

  return (
    <CheckoutFormContext.Provider value={value}>
      {children}
    </CheckoutFormContext.Provider>
  );
}

export function useCheckoutForm(): CheckoutFormContextValue {
  const ctx = useContext(CheckoutFormContext);
  if (!ctx)
    throw new Error("useCheckoutForm must be used within CheckoutFormProvider");
  return ctx;
}
