import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), getCookie: vi.fn(), setCookie: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }) }) }));
vi.mock("@tanstack/react-start/server", () => ({ getCookie: mocks.getCookie, setCookie: mocks.setCookie, setResponseHeader: vi.fn(), getRequestUrl: () => new URL("https://www.maisonaffluency.com") }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));
import { readNamedQuote, requestNamedQuoteCode, verifyNamedQuoteCode } from "./namedQuoteAccess.functions";
const call = (fn: unknown, data: Record<string, string>) => (fn as (input: { data: Record<string, string> }) => Promise<unknown>)({ data });
beforeEach(() => { vi.clearAllMocks(); mocks.getCookie.mockReturnValue(undefined); mocks.invoke.mockResolvedValue({ error: null, data: { success: true } }); });
describe("names-only private quote access", () => {
  it("does not read a quote from the public locator without a verified session", async () => {
    expect(await call(readNamedQuote, { slug: "alinea-angelo-m-h-high-table" })).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("sends codes only to the recipient returned by the validated database request", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: "challenge", email: "saved@example.com", code: "482913" }, error: null });
    expect(await call(requestNamedQuoteCode, { slug: "alinea-angelo-m-h-high-table", email: "input@example.com" })).toEqual({ ok: true });
    expect(mocks.invoke).toHaveBeenCalledWith("send-transactional-email", { body: { templateName: "private-client-code", recipientEmail: "saved@example.com", idempotencyKey: "quote-access-challenge", templateData: { code: "482913" } } });
  });
  it("does not send to unrecognised recipients and returns the same generic result", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await call(requestNamedQuoteCode, { slug: "alinea-angelo-m-h-high-table", email: "other@example.com" })).toEqual({ ok: true });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("keeps verified secrets out of returned data and stores them in secure HttpOnly cookies", async () => {
    mocks.rpc.mockResolvedValue({ data: "secret-session", error: null });
    expect(await call(verifyNamedQuoteCode, { slug: "alinea-angelo-m-h-high-table", email: "saved@example.com", code: "482913" })).toEqual({ ok: true });
    expect(mocks.setCookie).toHaveBeenCalledWith("ma_quote_alinea-angelo-m-h-high-table", "secret-session", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 86400 });
  });
  it("does not grant a session after incorrect or expired verification", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await call(verifyNamedQuoteCode, { slug: "alinea-angelo-m-h-high-table", email: "saved@example.com", code: "000000" })).toEqual({ ok: false });
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
});