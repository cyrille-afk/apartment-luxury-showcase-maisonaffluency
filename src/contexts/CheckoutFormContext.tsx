import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Global checkout form state.
 *
 * The identity gateway (/cart/identify) collects the buyer's email first; the
 * payment stages (/checkout — contact, shipping, billing, review) must never
 * ask for it again. This slice keeps the value alive across route changes and
 * OAuth redirects (sessionStorage) so the email travels from the first input
 * all the way into the final purchase payload.
 */

export type CheckoutFormState = {
  email: string;
  guestName: string;
};

type CheckoutFormContextValue = CheckoutFormState & {
  setEmail: (email: string) => void;
  setGuestName: (name: string) => void;
  update: (patch: Partial<CheckoutFormState>) => void;
  reset: () => void;
};

const STORAGE_KEY = "ma_checkout_form";

const EMPTY: CheckoutFormState = { email: "", guestName: "" };

function load(): CheckoutFormState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      email: typeof parsed.email === "string" ? parsed.email : "",
      guestName: typeof parsed.guestName === "string" ? parsed.guestName : "",
    };
  } catch {
    return EMPTY;
  }
}

function persist(state: CheckoutFormState) {
  try {
    if (!state.email && !state.guestName) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    /* private mode — in-memory state still works */
  }
}

const CheckoutFormContext = createContext<CheckoutFormContextValue | null>(null);

export function CheckoutFormProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CheckoutFormState>(load);

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
  const reset = useCallback(() => {
    persist(EMPTY);
    setState(EMPTY);
  }, []);

  const value = useMemo<CheckoutFormContextValue>(
    () => ({ ...state, setEmail, setGuestName, update, reset }),
    [state, setEmail, setGuestName, update, reset],
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
