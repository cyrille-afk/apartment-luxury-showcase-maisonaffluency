/**
 * Server-side mirror of the shopping bag so abandoned baskets can be measured
 * in the sales funnel and recovered by email. Purely additive: nothing here
 * ever mutates the local basket, and every failure is swallowed silently.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/lib/cart";

const SESSION_KEY = "ma_cart_session_id";
const CONTACT_KEY = "ma_cart_contact";

function sessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function readContact(): { email?: string; name?: string } {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CONTACT_KEY) || "{}");
  } catch {
    return {};
  }
}

/** Called wherever the shopper hands over an email during checkout. */
export function setCartContact(email?: string | null, name?: string | null) {
  if (typeof window === "undefined") return;
  const current = readContact();
  const next = {
    email: email?.trim() || current.email,
    name: name?.trim() || current.name,
  };
  try {
    window.localStorage.setItem(CONTACT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  void syncCart();
}

let timer: ReturnType<typeof setTimeout> | null = null;
let lastPayload = "";

async function push(items: CartItem[], status: "active" | "ordered") {
  const id = sessionId();
  if (!id) return;
  const contact = readContact();
  const { data: session } = await supabase.auth.getSession().catch(() => ({ data: null } as never));
  const user = session?.session?.user ?? null;

  const body = {
    sessionId: id,
    status,
    userId: user?.id ?? null,
    email: contact.email ?? user?.email ?? null,
    name: contact.name ?? null,
    currency: items[0]?.currency ?? null,
    items: items.map((i) => ({
      title: i.title,
      designerName: i.designerName,
      finishLabel: i.finishLabel,
      imageUrl: i.imageUrl,
      productPath:
        i.designerSlug && i.productSlug ? `/designers/${i.designerSlug}/${i.productSlug}` : null,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
  };

  const signature = JSON.stringify(body);
  if (status === "active" && signature === lastPayload) return;
  lastPayload = signature;

  try {
    await supabase.functions.invoke("track-cart", { body });
  } catch {
    /* tracking must never break the basket */
  }
}

/** Debounced sync of the live basket. */
export function syncCart(items?: CartItem[]) {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    const { getCart } = await import("@/lib/cart");
    void push(items ?? getCart(), "active");
  }, 1500);
}

/** An order was placed — the bag is converted, not abandoned. */
export function markCartOrdered(items: CartItem[]) {
  if (timer) clearTimeout(timer);
  void push(items, "ordered");
}
