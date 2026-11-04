import { StrictMode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), token: "a".repeat(48), component: null as null | (() => React.ReactNode) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/lib/quoteShareHead.functions", () => ({ getQuoteShareHead: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/namedQuoteAccess.functions", () => ({ readNamedQuote: vi.fn(async () => null), requestNamedQuoteCode: vi.fn(), verifyNamedQuoteCode: vi.fn(), changeNamedQuoteFinish: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: () => React.ReactNode }) => {
    mocks.component = options.component;
    return { useParams: () => ({ token: mocks.token }) };
  },
}));
import "./quote_.$token";

const track = vi.fn();
const snapshot = { version: 1, quoteRef: "QU-PRIVATE", clientName: "Private Client", lines: [], totals: [], lineCount: 0, totalUnits: 0, unpricedCount: 0, shared_at: "2026-11-02", expires_at: "2026-12-02" };
function openQuote() {
  const Page = mocks.component;
  if (!Page) throw new Error("Quote route was not registered");
  return render(<StrictMode><Page /></StrictMode>);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.token = "a".repeat(48);
  mocks.rpc.mockResolvedValue({ data: snapshot, error: null });
  window.__lovableEvents = { track };
});
afterEach(() => { cleanup(); delete window.__lovableEvents; });

describe("Quote opens", () => {
  it("counts successful quote access once with no client, reference, URL or token properties", async () => {
    openQuote();
    await waitFor(() => expect(track).toHaveBeenCalledExactlyOnceWith("project.quote_opened", {}));
    expect(JSON.stringify(track.mock.calls)).not.toContain(snapshot.clientName);
    expect(JSON.stringify(track.mock.calls)).not.toContain(snapshot.quoteRef);
    expect(JSON.stringify(track.mock.calls)).not.toContain(mocks.token);
  });
  it.each([{ data: null, error: null }, { data: snapshot, error: { message: "Failed" } }])("does not count unavailable or failed quote reads", async (result) => {
    mocks.rpc.mockResolvedValue(result);
    openQuote();
    await screen.findByRole("heading", { name: "This link is no longer available" });
    expect(track).not.toHaveBeenCalled();
  });
  it("does not count invalid private tokens", async () => {
    mocks.token = "invalid";
    openQuote();
    await screen.findByRole("heading", { name: "This link is no longer available" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
  it("ignores responses after the page has been left", async () => {
    let resolve: ((value: unknown) => void) | undefined;
    mocks.rpc.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const view = openQuote();
    view.unmount();
    resolve?.({ data: snapshot, error: null });
    await Promise.resolve();
    expect(track).not.toHaveBeenCalled();
  });
  it("loads normally without the injected tracker", async () => {
    delete window.__lovableEvents;
    openQuote();
    await screen.findByRole("heading", { name: `Quote ${snapshot.quoteRef}` });
    expect(track).not.toHaveBeenCalled();
  });
});