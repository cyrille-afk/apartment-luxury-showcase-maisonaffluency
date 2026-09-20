/**
 * GDPR / CNIL consent store.
 *
 * Single source of truth for cookie-category consent across the public site,
 * the /trade workspace and the installed PWA.
 *
 * Guarantees:
 *  - No non-essential script may run without an explicit affirmative choice.
 *  - Choices expire after 180 days (sliding window on re-confirmation).
 *  - A privacy-policy version bump invalidates every stored choice.
 *  - The record is mirrored to localStorage + a first-party cookie so the
 *    banner never reappears spuriously, and is logged server-side for audit.
 */

export const CONSENT_POLICY_VERSION =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_PRIVACY_POLICY_VERSION || "2026-09-20.1";

export const CONSENT_MAX_AGE_DAYS = 180;
const CONSENT_MAX_AGE_MS = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export const CONSENT_STORAGE_KEY = "ma_consent_v2";
export const CONSENT_EVENT = "ma-consent-change";

export type ConsentCategory = "necessary" | "functional" | "analytics" | "marketing";

export interface ConsentScopes {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface ConsentRecord {
  subjectId: string;
  scopes: ConsentScopes;
  policyVersion: string;
  /** ISO-8601 UTC timestamp of the affirmative action. */
  decidedAt: string;
  /** 'accept_all' | 'reject_all' | 'custom' */
  method: "accept_all" | "reject_all" | "custom";
}

export const DENY_ALL: ConsentScopes = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
};

export const ALLOW_ALL: ConsentScopes = {
  necessary: true,
  functional: true,
  analytics: true,
  marketing: true,
};

const isBrowser = () => typeof window !== "undefined";

const readCookie = (name: string): string | null => {
  try {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
};

const writeCookie = (name: string, value: string) => {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${name}=${encodeURIComponent(value)}; Max-Age=${Math.floor(
        CONSENT_MAX_AGE_MS / 1000
      )}; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* ignore */
  }
};

const parse = (raw: string | null): ConsentRecord | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (!parsed || typeof parsed !== "object" || !parsed.scopes) return null;
    if (parsed.policyVersion !== CONSENT_POLICY_VERSION) return null;
    const decided = Date.parse(parsed.decidedAt);
    if (!Number.isFinite(decided)) return null;
    if (Date.now() - decided > CONSENT_MAX_AGE_MS) return null;
    return {
      ...parsed,
      scopes: {
        necessary: true,
        functional: !!parsed.scopes.functional,
        analytics: !!parsed.scopes.analytics,
        marketing: !!parsed.scopes.marketing,
      },
    };
  } catch {
    return null;
  }
};

/** Pseudonymous, rotating-safe subject id. Never a user email or auth id. */
const getSubjectId = (): string => {
  const KEY = "ma_consent_subject";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return "anonymous";
  }
};

/** Returns the valid, unexpired consent record, or null when a prompt is due. */
export const readConsent = (): ConsentRecord | null => {
  if (!isBrowser()) return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  let record = parse(raw);
  if (!record) record = parse(readCookie(CONSENT_STORAGE_KEY));
  if (record) {
    // Heal both stores.
    const serialised = JSON.stringify(record);
    try {
      if (localStorage.getItem(CONSENT_STORAGE_KEY) !== serialised)
        localStorage.setItem(CONSENT_STORAGE_KEY, serialised);
    } catch {
      /* ignore */
    }
    if (readCookie(CONSENT_STORAGE_KEY) !== serialised)
      writeCookie(CONSENT_STORAGE_KEY, serialised);
  }
  return record;
};

export const getScopes = (): ConsentScopes => readConsent()?.scopes ?? DENY_ALL;

export const hasConsent = (category: ConsentCategory): boolean =>
  category === "necessary" ? true : getScopes()[category] === true;

/** Preview/staging hosts (never production). */
export const isTestEnvironment = (): boolean => {
  if (!isBrowser()) return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovableproject.com")
  );
};

const PROMPT_SUPPRESS_KEY = "ma_consent_prompt_suppress_until";
const TEST_PROMPT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // once a week

/** True when the banner must be shown (no record, expired, or policy bumped). */
export const needsConsentPrompt = (): boolean => {
  if (readConsent() !== null) return false;
  // On test environments the banner re-appears at most once a week, even when
  // the stored record cannot persist (partitioned storage, wiped cookies).
  if (isTestEnvironment()) {
    const now = Date.now();
    try {
      const until = Number(localStorage.getItem(PROMPT_SUPPRESS_KEY) || 0);
      if (Number.isFinite(until) && now < until) return false;
      localStorage.setItem(
        PROMPT_SUPPRESS_KEY,
        String(now + TEST_PROMPT_INTERVAL_MS)
      );
    } catch {
      /* storage unavailable — fall through and prompt */
    }
  }
  return true;
};

export const saveConsent = (
  scopes: ConsentScopes,
  method: ConsentRecord["method"]
): ConsentRecord => {
  const record: ConsentRecord = {
    subjectId: getSubjectId(),
    scopes: { ...scopes, necessary: true },
    policyVersion: CONSENT_POLICY_VERSION,
    decidedAt: new Date().toISOString(),
    method,
  };
  const serialised = JSON.stringify(record);
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, serialised);
  } catch {
    /* ignore */
  }
  writeCookie(CONSENT_STORAGE_KEY, serialised);

  // Legacy mirror so pre-existing gates keep working.
  try {
    localStorage.setItem("cookie_consent", record.scopes.analytics ? "accepted" : "declined");
    if (!record.scopes.analytics) localStorage.setItem("ga_optout", "1");
    else localStorage.removeItem("ga_optout");
  } catch {
    /* ignore */
  }

  applyConsent(record.scopes);
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: record }));
  } catch {
    /* ignore */
  }
  void logConsentServerSide(record);
  return record;
};

/** Starts or suppresses tracking layers to match the current scopes. */
export const applyConsent = (scopes: ConsentScopes) => {
  if (!isBrowser()) return;
  const w = window as unknown as {
    __loadGA4?: () => void;
    gtag?: (...args: unknown[]) => void;
    __maConsentScopes?: ConsentScopes;
  };
  w.__maConsentScopes = scopes;

  if (w.gtag) {
    w.gtag("consent", "update", {
      analytics_storage: scopes.analytics ? "granted" : "denied",
      ad_storage: scopes.marketing ? "granted" : "denied",
      ad_user_data: scopes.marketing ? "granted" : "denied",
      ad_personalization: scopes.marketing ? "granted" : "denied",
      functionality_storage: scopes.functional ? "granted" : "denied",
      personalization_storage: scopes.functional ? "granted" : "denied",
    });
  }

  if (scopes.analytics && typeof w.__loadGA4 === "function") w.__loadGA4();
};

/** Immutable server-side audit trail (GDPR Art. 7(1)). Never blocks the UI. */
export const logConsentServerSide = async (record: ConsentRecord): Promise<void> => {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.functions.invoke("log-consent", {
      body: {
        subjectId: record.subjectId,
        policyVersion: record.policyVersion,
        decidedAt: record.decidedAt,
        method: record.method,
        scopes: record.scopes,
        path: window.location.pathname,
        surface: window.matchMedia?.("(display-mode: standalone)").matches
          ? "pwa"
          : "web",
      },
    });
  } catch {
    /* audit logging must never break the page */
  }
};

/** Re-applies stored consent on boot. Denies everything when no record exists. */
export const bootstrapConsent = () => {
  if (!isBrowser()) return;
  applyConsent(getScopes());
};
