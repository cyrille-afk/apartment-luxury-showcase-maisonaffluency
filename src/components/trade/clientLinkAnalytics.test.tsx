import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShareQuoteWithClient from "./ShareQuoteWithClient";
import GuestPayLinkCard from "./GuestPayLinkCard";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), invoke: vi.fn(), toast: vi.fn(), update: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from, functions: { invoke: mocks.invoke } } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.toast, success: mocks.toast } }));
vi.mock("@/lib/quoteClientShare", () => ({ buildSharedQuoteSnapshot: () => ({ lines: [{ name: "Test piece", maker: "Test maker" }] }) }));

const link = { id: "test-link", token: "private-token", amount_cents: 60000, currency: "EUR", label: "Deposit", payer_email: "test@example.com", status: "active", created_at: "2026-11-02" };
const track = vi.fn();
const writeText = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  window.__lovableEvents = { track };
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  writeText.mockResolvedValue(undefined);
  mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
  mocks.rpc.mockResolvedValue({ data: "test-maker-test-piece", error: null });
  mocks.from.mockImplementation((table: string) => {
    const query: Record<string, unknown> = {};
    for (const key of ["select", "eq", "insert"]) query[key] = () => query;
    query.update = (value: unknown) => { mocks.update(value); return query; };
    query.order = () => Promise.resolve({ data: table === "trade_quote_items" ? [{ quantity: 1 }] : [link], error: null });
    query.maybeSingle = () => Promise.resolve({ data: { client_name: "Test", end_client_billing: { email: "test@example.com" } }, error: null });
    query.single = () => Promise.resolve({ data: { ...link, id: "new-test-link", end_client_billing: { email: "test@example.com", company: "Test Studio", country: "SG" } }, error: null });
    return query;
  });
});
afterEach(() => { cleanup(); delete window.__lovableEvents; });

describe("client link analytics", () => {
  const shareQuote = async () => {
    const button = screen.getByRole("button", { name: "Share with client" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
  };
  it("tracks a quote copy only after a successful clipboard write without private properties", async () => {
    render(<ShareQuoteWithClient quoteId="test-quote" />);
    await shareQuote();
    await waitFor(() => expect(track).toHaveBeenCalledExactlyOnceWith("project.client_link_copied", { link_type: "quote" }));
    expect(writeText).toHaveBeenCalledWith("https://www.maisonaffluency.com/quote/test-maker-test-piece");
  });
  it("does not track a rejected quote clipboard write", async () => {
    writeText.mockRejectedValue(new Error("Denied"));
    render(<ShareQuoteWithClient quoteId="test-quote" />);
    await shareQuote();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(track).not.toHaveBeenCalled();
  });
  it("does not create or copy a link when the server requires a saved client email", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "save client email before sharing" } });
    render(<ShareQuoteWithClient quoteId="test-quote" />);
    await shareQuote();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(writeText).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("create_named_quote_share", expect.objectContaining({ _quote_id: "test-quote" }));
  });
  it("saves a normalized recipient before sharing without replacing billing fields or contacts", async () => {
    render(<ShareQuoteWithClient quoteId="test-quote" />);
    const input = await screen.findByRole("textbox", { name: "Client email" });
    await waitFor(() => expect(input).toBeEnabled());
    fireEvent.change(input, { target: { value: "  Recipient@Example.com  " } });
    await shareQuote();
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ end_client_billing: { email: "recipient@example.com", company: "Test Studio", country: "SG" } });
    expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
    expect(mocks.from.mock.calls.every(([table]) => table !== "client_contacts")).toBe(true);
  });
  it("rejects invalid recipients without writing or sharing", async () => {
    render(<ShareQuoteWithClient quoteId="test-quote" />);
    const input = screen.getByRole("textbox", { name: "Client email" });
    await waitFor(() => expect(input).toBeEnabled());
    fireEvent.change(input, { target: { value: "not-an-email" } });
    await shareQuote();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });
  it("does not share after recipient saving fails", async () => {
    mocks.update.mockImplementationOnce(() => { throw new Error("Save failed"); });
    render(<ShareQuoteWithClient quoteId="test-quote" />);
    await shareQuote();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });
  it("saves email separately without creating a share", async () => {
    render(<ShareQuoteWithClient quoteId="test-quote" />);
    const button = screen.getByRole("button", { name: "Save client email" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });
  it("tracks existing and newly created guest link copies, but never a send", async () => {
    render(<GuestPayLinkCard quoteId="test-quote" currency="EUR" orderTotalCents={100000} />);
    fireEvent.click(await screen.findByRole("button", { name: "Copy" }));
    await waitFor(() => expect(track).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Create link" }));
    await waitFor(() => expect(track).toHaveBeenCalledTimes(2));
    expect(track.mock.calls).toEqual(Array(2).fill(["project.client_link_copied", { link_type: "guest_payment" }]));
  });
  it("does not count failed guest copies, including auto-copy on creation", async () => {
    writeText.mockRejectedValue(new Error("Denied"));
    render(<GuestPayLinkCard quoteId="test-quote" currency="EUR" orderTotalCents={100000} />);
    fireEvent.click(await screen.findByRole("button", { name: "Copy" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Create link" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(2));
    expect(track).not.toHaveBeenCalled();
  });
  it("counts an email only after confirmed send, without recipient, token or quote identifiers", async () => {
    render(<GuestPayLinkCard quoteId="test-quote" currency="EUR" orderTotalCents={100000} defaultEmail="test@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Email client" }));
    await waitFor(() => expect(track).toHaveBeenCalledExactlyOnceWith("project.client_link_sent", { link_type: "guest_payment", channel: "email" }));
  });
  it.each([{ data: null, error: new Error("Failed") }, { data: { error: "Failed" }, error: null }])("does not count failed email sends", async (result) => {
    mocks.invoke.mockResolvedValue(result);
    render(<GuestPayLinkCard quoteId="test-quote" currency="EUR" orderTotalCents={100000} defaultEmail="test@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Email client" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(track).not.toHaveBeenCalled();
  });
  it("works safely when the injected tracker is absent", async () => {
    delete window.__lovableEvents;
    render(<ShareQuoteWithClient quoteId="test-quote" />);
    await shareQuote();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(track).not.toHaveBeenCalled();
  });
});