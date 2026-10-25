import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import AuthGateDialog from "../AuthGateDialog";

const toast = vi.hoisted(() => vi.fn());
const signInWithPassword = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isPwaBooting: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithPassword, signUp: vi.fn() } },
}));
vi.mock("@/integrations/lovable", () => ({
  lovable: { auth: { signInWithOAuth: vi.fn() } },
}));
vi.mock("@/lib/storageReclaim", () => ({ ensureStorageHeadroom: vi.fn() }));
vi.mock("@/components/GoogleAccessRequestForm", () => ({
  GoogleAccessRequestForm: () => null,
}));
vi.mock("@/lib/router-compat", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

/** Index of an element among all descendants of the dialog, in document order. */
function orderIndex(dialog: HTMLElement, el: Element) {
  return Array.from(dialog.querySelectorAll("*")).indexOf(el);
}

function renderLogin() {
  render(
    <AuthGateDialog
      open
      onClose={() => {}}
      initialMode="login"
      action="sign in"
    />,
  );
  return screen.getByRole("dialog");
}

afterEach(() => {
  cleanup();
  toast.mockReset();
  signInWithPassword.mockReset();
});

describe("Sign-in modal layout and copy", () => {
  it("puts the credential form first, the separator next, then Google at the bottom", () => {
    const dialog = renderLogin();
    const email = dialog.querySelector('input[type="email"]') as HTMLInputElement;
    const password = dialog.querySelector('input[type="password"]') as HTMLInputElement;
    const submit = screen.getByRole("button", { name: /^Sign In$/ });
    const separator = screen.getByText("or");
    const google = screen.getByRole("button", { name: /Continue with Google/ });
    const helper = screen.getByText(/internal staff only/);
    const footer = screen.getByRole("link", { name: /Apply for the Trade Program/ });

    const indexes = [email, password, submit, separator, google, helper, footer].map(
      (el) => orderIndex(dialog, el),
    );
    expect(indexes.every((n) => n >= 0)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it("shows the approved helper line under the Google button with the trade mailbox", () => {
    renderLogin();
    const helper = screen.getByText(/internal staff only/);
    expect(helper.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Google Sign-In is for internal staff only. If you are a Trade Member and prefer Google access, please contact trade@maisonaffluency.com to whitelist your email.",
    );
    expect(
      screen.getByRole("link", { name: "trade@maisonaffluency.com" }).getAttribute("href"),
    ).toBe("mailto:trade@maisonaffluency.com");
  });

  it("keeps the footer link to one Trade Program application line", () => {
    renderLogin();
    expect(
      screen.getByRole("link", { name: "Don’t have an account? Apply for the Trade Program." })
        .getAttribute("href"),
    ).toBe("/trade-program?intent=apply");
    expect(screen.queryByText(/New to the Trade Program/)).toBeNull();
  });

  it("never quotes Google's technical error wording in the modal", () => {
    const dialog = renderLogin();
    const text = dialog.textContent ?? "";
    for (const raw of ["org_internal", "Access blocked", "Restricted account", "Note:"]) {
      expect(text).not.toContain(raw);
    }
  });

  it("replaces a raw auth rejection with an actionable sentence", async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
      data: { session: null, user: null },
    });
    const dialog = renderLogin();
    fireEvent.change(dialog.querySelector('input[type="email"]') as HTMLInputElement, {
      target: { value: "member@studio.com" },
    });
    fireEvent.change(dialog.querySelector('input[type="password"]') as HTMLInputElement, {
      target: { value: "wrongpassword1!" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Sign In$/ }));
    });
    expect(screen.getByRole("alert").textContent).toContain("Check your email and password");
    expect(screen.getByRole("alert").textContent).not.toContain("Invalid login credentials");
  });

  it("reveals and masks the same password without submitting", () => {
    renderLogin();
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Example-2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.type).toBe("text");
    expect(input.value).toBe("Example-2026!");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input.type).toBe("password");
    expect(input.value).toBe("Example-2026!");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("blocks competing sign-in while pending and permits retry after a thrown request", async () => {
    let rejectRequest: (error: Error) => void = () => {};
    signInWithPassword.mockImplementation(() => new Promise((_resolve, reject) => { rejectRequest = reject; }));
    const dialog = renderLogin();
    fireEvent.change(dialog.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: "member@studio.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Example-2026!" } });
    fireEvent.click(screen.getByRole("button", { name: /^Sign In$/ }));
    expect((screen.getByRole("button", { name: "Continue with Google" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Signing you in");
    await act(async () => rejectRequest(new Error("connection failed")));
    expect(screen.getByRole("alert").textContent).toContain("Please try again shortly");
    expect((screen.getByRole("button", { name: /^Sign In$/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
