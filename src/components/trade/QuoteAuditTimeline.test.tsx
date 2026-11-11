import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/lib/router-compat", () => ({ Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a> }));
import { QuoteAuditTimeline } from "./QuoteAuditTimeline";

describe("quote audit history reads", () => {
  it("reads the exact quote's server-authorized revision chain", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><QuoteAuditTimeline quoteId="original-quote" /></QueryClientProvider>);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("admin_quote_audit_timeline", { _quote_id: "original-quote" }));
    cleanup();
  });
  it("does not treat denied history access as an empty successful read", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error("Denied") });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><QuoteAuditTimeline quoteId="restricted-quote" /></QueryClientProvider>);
    expect(await screen.findByRole("alert")).toBeTruthy();
    cleanup();
  });
});