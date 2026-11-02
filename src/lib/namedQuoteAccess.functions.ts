import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, setResponseHeader, getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";

const locator = z.string().min(1).max(300).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const cookieName = (slug: string) => `ma_quote_${slug}`;

export const readNamedQuote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slug: locator }).parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const token = getCookie(cookieName(data.slug));
    if (!token) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: quote, error } = await supabaseAdmin.rpc("get_verified_quote", { _slug: data.slug, _session: token });
    if (error) throw new Error("Your quote could not be loaded. Please try again.");
    return quote;
  });

export const requestNamedQuoteCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slug: locator, email: z.string().trim().email().max(255) }).parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Service-only RPC validates the saved recipient, expiry and locked rate limits.
    const { data: result, error } = await supabaseAdmin.rpc("request_quote_access", { _slug: data.slug, _email: data.email });
    if (error) throw new Error("A verification code could not be requested. Please try again.");
    if (result && typeof result === "object" && !Array.isArray(result) && typeof result.email === "string" && typeof result.code === "string" && typeof result.id === "string") {
      const { error: sendError } = await supabaseAdmin.functions.invoke("send-transactional-email", { body: {
        templateName: "private-client-code", recipientEmail: result.email,
        idempotencyKey: `quote-access-${result.id}`, templateData: { code: result.code },
      } });
      if (sendError) throw new Error("The verification email could not be sent. Please try again shortly.");
    }
    // Same response for unknown email, unavailable locator and resend throttling.
    return { ok: true };
  });

export const verifyNamedQuoteCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slug: locator, email: z.string().trim().email().max(255), code: z.string().regex(/^\d{6}$/) }).parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: token, error } = await supabaseAdmin.rpc("verify_quote_access", { _slug: data.slug, _email: data.email, _code: data.code });
    if (error || !token) return { ok: false };
    setCookie(cookieName(data.slug), token, { httpOnly: true, secure: getRequestUrl().protocol === "https:", sameSite: "strict", path: "/", maxAge: 86400 });
    return { ok: true };
  });