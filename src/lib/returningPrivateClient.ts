/** Device-local recognition only. Entered emails never authorize customer data. */
const KEY = "ma_private_client_visits_v1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type Visits = Record<string, true>;
const OPT_OUT_KEY = "ma_private_client_optout_v1";

function optedOut(): Set<string> {
  const v = read(OPT_OUT_KEY);
  return new Set(Array.isArray(v) ? v.filter((e): e is string => typeof e === "string") : []);
}

/** Removes this device's recognition record and stops future local recognition for the email. */
export function forgetPrivateClient(email: string) {
  const normalized = normalizeClientEmail(email);
  if (!normalized) return;
  try {
    const kept = Object.fromEntries(Object.entries(visits()).filter(([k]) => k !== normalized));
    localStorage.setItem(KEY, JSON.stringify(kept));
    localStorage.setItem(OPT_OUT_KEY, JSON.stringify([...new Set([...optedOut(), normalized])].slice(-100)));
  } catch { /* never interrupt ordering */ }
}

export function normalizeClientEmail(value: unknown): string {
  return typeof value === "string" && EMAIL_RE.test(value.trim()) ? value.trim().toLowerCase() : "";
}

function read(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}

function visits(): Visits {
  const value = read(KEY);
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([email, seen]) => normalizeClientEmail(email) === email && seen === true));
}

export function rememberPrivateClient(email: string, profile: string | null) {
  const normalized = normalizeClientEmail(email);
  if (!normalized || profile !== "private" || optedOut().has(normalized)) return;
  try {
    const entries = Object.entries(visits()).filter(([key]) => key !== normalized);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries([...entries.slice(-99), [normalized, true]])));
  } catch { /* Recognition must never interrupt ordering. */ }
}

/** Capture before an input overwrites checkout storage, so typing cannot self-recognize. */
export function rememberedPrivateClients(): Set<string> {
  const emails = new Set(Object.keys(visits()));
  const form = read("ma_checkout_form") as { email?: unknown; buyerProfile?: unknown } | null;
  const contact = read("ma_cart_contact") as { email?: unknown } | null;
  const email = normalizeClientEmail(form?.email);
  const contactEmail = normalizeClientEmail(contact?.email);
  const basket = read("ma_cart_v1_backup") ?? read("ma_cart_v1");
  const lines = Array.isArray(basket) ? basket : (basket as { lines?: unknown[] } | null)?.lines;
  // Migrate legacy local evidence; a form alone is not a previous purchase/basket.
  if (form?.buyerProfile === "private" && email &&
      ((Array.isArray(lines) && lines.length > 0) || read("ma_cart_order_placed") === 1)) {
    emails.add(email);
    if (contactEmail === email) emails.add(contactEmail);
  }
  for (const e of optedOut()) emails.delete(e);
  return emails;
}

export function isReturningPrivateClient(email: string, profile: string | null, remembered: Set<string>): boolean {
  const normalized = normalizeClientEmail(email);
  return profile === "private" && Boolean(normalized) && remembered.has(normalized);
}