import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup, waitFor, act } from "@testing-library/react";
import TradeLogin from "../TradeLogin";
import { supabase } from "@/integrations/supabase/client";

vi.mock("react-helmet-async", () => ({ Helmet: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      resetPasswordForEmail: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));
vi.mock("@/integrations/lovable", () => ({
  lovable: { auth: { signInWithOAuth: vi.fn() } },
}));
vi.mock("@/lib/storageReclaim", () => ({ ensureStorageHeadroom: vi.fn() }));
vi.mock("@/lib/emailPortalClick", () => ({ recordEmailPortalClick: vi.fn() }));
vi.mock("@/components/trade/MobileTradeTourNotice", () => ({
  MobileTradeTourNotice: () => null,
}));
vi.mock("@/components/GoogleAccessNotice", () => ({
  GoogleAccessNotice: () => null,
}));
vi.mock("@/lib/googleSignInRecovery", () => ({
  clearGoogleAttempt: vi.fn(),
  readGoogleAttempt: () => false,
  startGoogleAttempt: vi.fn(),
}));
vi.mock("@/lib/router-compat", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

function passwordField() {
  return screen.getByPlaceholderText("Password") as HTMLInputElement;
}

function toggleButton() {
  return screen.getByRole("button", { name: /^(Show|Hide) password$/ }) as HTMLButtonElement;
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Trade Program sign-in password reveal", () => {
  it("starts hidden with an empty field", () => {
    render(<TradeLogin />);
    const field = passwordField();
    expect(field.getAttribute("type")).toBe("password");
    expect(field.value).toBe("");
    expect(field.getAttribute("autocomplete")).toBe("new-password");
    expect(toggleButton().getAttribute("aria-pressed")).toBe("false");
    expect(toggleButton().getAttribute("aria-label")).toBe("Show password");
  });

  it("shows the exact typed characters, then hides them again without losing them", () => {
    render(<TradeLogin />);
    const field = passwordField();
    fireEvent.change(field, { target: { value: "Cor-Rect-2026!" } });

    fireEvent.click(toggleButton());
    expect(field.getAttribute("type")).toBe("text");
    expect(field.value).toBe("Cor-Rect-2026!");
    expect(toggleButton().getAttribute("aria-label")).toBe("Hide password");
    expect(toggleButton().getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(toggleButton());
    expect(field.getAttribute("type")).toBe("password");
    expect(field.value).toBe("Cor-Rect-2026!");
    expect(toggleButton().getAttribute("aria-pressed")).toBe("false");
  });

  it("never submits the form when the reveal is clicked", () => {
    render(<TradeLogin />);
    expect(toggleButton().getAttribute("type")).toBe("button");
  });
  it("blocks duplicate submissions while pending and enables retry after rejection", async () => {
    let complete: ((value: any) => void) | undefined;
    vi.mocked(supabase.auth.signInWithPassword).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    render(<TradeLogin />);
    fireEvent.change(screen.getByPlaceholderText("Trade ID or Email Address"), { target: { value: "test@example.com" } });
    fireEvent.change(passwordField(), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In", exact: true }));
    expect(screen.getByRole("button", { name: "Signing In", exact: true })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    fireEvent.submit(passwordField().closest("form") as HTMLFormElement);
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    await act(async () => { complete?.({ data: { session: null, user: null }, error: { code: "invalid_credentials", status: 400 } }); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign In", exact: true })).toBeEnabled());
    expect(passwordField().value).toBe("wrong-password");
  });
  it("keeps submissions locked after confirmed authentication", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({ data: { session: null, user: null }, error: null });
    render(<TradeLogin />);
    fireEvent.change(screen.getByPlaceholderText("Trade ID or Email Address"), { target: { value: "test@example.com" } });
    fireEvent.change(passwordField(), { target: { value: "test-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In", exact: true }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Signed In", exact: true })).toBeDisabled());
  });
});
