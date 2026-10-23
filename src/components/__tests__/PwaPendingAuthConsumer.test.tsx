import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaPendingAuthConsumer } from "../PwaPendingAuthConsumer";
import { storePendingAuthToken } from "@/lib/pwaPendingAuth";

const mocks = vi.hoisted(() => ({
  auth: { loading: false, user: null as null | { id: string }, rolesLoaded: false },
  standalone: true,
  pending: "a".repeat(43) as string | null,
  navigate: vi.fn(async () => {}),
  clear: vi.fn(),
  booting: vi.fn(),
  getSession: vi.fn(), redeem: vi.fn(), verify: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ ...mocks.auth, setIsPwaBooting: mocks.booting }) }));
vi.mock("@/lib/pwaMode", () => ({ isInstalledPwaDisplay: () => mocks.standalone }));
vi.mock("@/lib/pwaPendingAuth", () => ({ readPendingAuthToken: () => mocks.pending, clearPendingAuthToken: mocks.clear, storePendingAuthToken: vi.fn((token) => { mocks.pending = token; }) }));
vi.mock("@/lib/mobileSync.functions", () => ({ redeemMobileSyncToken: mocks.redeem, MOBILE_SYNC_TTL_SECONDS: 120 }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: mocks.getSession, verifyOtp: mocks.verify } } }));

const renderGate = () => render(<PwaPendingAuthConsumer><div data-testid="dashboard" /></PwaPendingAuthConsumer>);
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
  mocks.auth = { loading: false, user: null, rolesLoaded: false };
  mocks.standalone = true; mocks.pending = "a".repeat(43);
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.redeem.mockResolvedValue({ ok: true, tokenHash: "verified-hash" });
  mocks.verify.mockResolvedValue({ data: { session: { user: { id: "member" } } }, error: null });
});
afterEach(cleanup);

describe("installed app startup handshake", () => {
  it("keeps shared boot state active until validation, roles and navigation finish", async () => {
    let resolve: ((value: { ok: true; tokenHash: string }) => void) | undefined;
    mocks.redeem.mockReturnValue(new Promise(r => { resolve = r; }));
    const view = renderGate();
    await waitFor(() => expect(mocks.redeem).toHaveBeenCalled());
    expect(mocks.booting).toHaveBeenLastCalledWith(true);
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => resolve?.({ ok: true, tokenHash: "verified-hash" }));
    expect(mocks.booting).toHaveBeenLastCalledWith(true);
    mocks.auth = { loading: false, user: { id: "member" }, rolesLoaded: true };
    view.rerender(<PwaPendingAuthConsumer><div data-testid="dashboard" /></PwaPendingAuthConsumer>);
    await waitFor(() => expect(mocks.booting).toHaveBeenLastCalledWith(false));
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
  });
  it("uses the root splash for a direct standalone sync link", async () => {
    mocks.pending = null;
    window.history.replaceState({}, "", `/auth/sync?t=${"c".repeat(43)}`);
    renderGate();
    await waitFor(() => expect(mocks.redeem).toHaveBeenCalledWith({ data: { token: "c".repeat(43) } }));
    expect(screen.queryByTestId("dashboard")).toBeNull();
    expect(window.location.search).toBe("");
  });
  it("redeems a manifest launch code even with no Safari storage", async () => {
    mocks.pending = null;
    const token = "b".repeat(43);
    window.history.replaceState({}, "", `/?source=pwa&token=${token}`);
    renderGate();
    await waitFor(() => expect(mocks.redeem).toHaveBeenCalledWith({ data: { token } }));
    expect(storePendingAuthToken).toHaveBeenCalledWith(token, 120);
    expect(window.location.search).toBe("?source=pwa");
    expect(screen.queryByTestId("dashboard")).toBeNull();
  });
  it("holds route children until OTP and roles are ready, then enters the dashboard", async () => {
    const view = renderGate();
    await waitFor(() => expect(mocks.verify).toHaveBeenCalledWith({ token_hash: "verified-hash", type: "magiclink" }));
    expect(screen.queryByTestId("dashboard")).toBeNull();
    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).not.toHaveBeenCalled();
    mocks.auth = { loading: false, user: { id: "member" }, rolesLoaded: true };
    view.rerender(<PwaPendingAuthConsumer><div data-testid="dashboard" /></PwaPendingAuthConsumer>);
    await waitFor(() => expect(screen.getByTestId("dashboard")).toBeInTheDocument());
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/trade", replace: true });
    expect(mocks.redeem).toHaveBeenCalledTimes(1);
  });
  it("waits for initial restoration before redeeming", async () => {
    mocks.auth.loading = true;
    const view = renderGate();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(screen.queryByTestId("dashboard")).toBeNull();
    mocks.auth.loading = false;
    view.rerender(<PwaPendingAuthConsumer><div data-testid="dashboard" /></PwaPendingAuthConsumer>);
    await waitFor(() => expect(mocks.redeem).toHaveBeenCalledTimes(1));
  });
  it("reuses an unexpired session rather than consuming the pending code", async () => {
    mocks.auth = { loading: false, user: { id: "member" }, rolesLoaded: true };
    mocks.getSession.mockResolvedValue({ data: { session: { expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null });
    renderGate();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    expect(mocks.redeem).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.clear).toHaveBeenCalledTimes(1);
  });
  it("never redeems the static browser bridge token", () => {
    mocks.standalone = false;
    renderGate();
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    expect(mocks.redeem).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });
  it("falls through normally with no pending code", () => {
    mocks.pending = null;
    renderGate();
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    expect(mocks.redeem).not.toHaveBeenCalled();
  });
  it("keeps routes unmounted when the server rejects a used code", async () => {
    mocks.redeem.mockResolvedValue({ ok: false, reason: "expired" });
    renderGate();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(mocks.booting).toHaveBeenLastCalledWith(false);
    expect(screen.queryByTestId("dashboard")).toBeNull();
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.clear).toHaveBeenCalled();
    await act(async () => screen.getByRole("button", { name: "Sign in" }).click());
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/trade/login", search: { next: "/trade" }, replace: true });
  });
  it("keeps a possibly unconsumed token on network failure", async () => {
    mocks.redeem.mockRejectedValue(new Error("offline"));
    renderGate();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(screen.queryByTestId("dashboard")).toBeNull();
  });
  it("retries a temporary failure with the same code and enters the dashboard", async () => {
    mocks.redeem.mockRejectedValueOnce(new Error("offline"));
    const view = renderGate();
    const retry = await screen.findByRole("button", { name: /try again/i });
    expect(mocks.clear).not.toHaveBeenCalled();
    await act(async () => retry.click());
    await waitFor(() => expect(mocks.redeem).toHaveBeenCalledTimes(2));
    expect(mocks.redeem).toHaveBeenLastCalledWith({ data: { token: "a".repeat(43) } });
    mocks.auth = { loading: false, user: { id: "member" }, rolesLoaded: true };
    view.rerender(<PwaPendingAuthConsumer><div data-testid="dashboard" /></PwaPendingAuthConsumer>);
    await waitFor(() => expect(screen.getByTestId("dashboard")).toBeInTheDocument());
  });
  it("offers no retry when the code was rejected", async () => {
    mocks.redeem.mockResolvedValue({ ok: false });
    renderGate();
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });
});