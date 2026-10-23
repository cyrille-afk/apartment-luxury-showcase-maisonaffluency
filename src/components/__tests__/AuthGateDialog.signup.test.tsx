import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ signup: vi.fn(), navigate: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signUp: mocks.signup }, functions: { invoke: mocks.invoke } } }));
vi.mock("@/integrations/lovable", () => ({ lovable: { auth: {} } }));
vi.mock("@/lib/router-compat", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/lib/storageReclaim", () => ({ ensureStorageHeadroom: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isPwaBooting: false }) }));
import AuthGateDialog from "../AuthGateDialog";

function setup(password = "Unique-check-2026") {
  const close = vi.fn();
  render(<AuthGateDialog open onClose={close} initialMode="signup" />);
  fireEvent.change(screen.getByPlaceholderText("Email address *"), { target: { value: "  signup@example.com  " } });
  fireEvent.change(screen.getByPlaceholderText("Create password *"), { target: { value: password } });
  return close;
}
function submit() { fireEvent.submit(screen.getByRole("button", { name: "Register" }).closest("form") as HTMLFormElement); }
describe("public signup persistence", () => {
  beforeEach(() => vi.clearAllMocks());
  it("never submits a short password", () => {
    setup("abc"); submit(); expect(mocks.signup).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  it("keeps the form open after auth rejection and allows retry", async () => {
    mocks.signup.mockResolvedValueOnce({ error: { message: "Password has been leaked" }, data: null });
    mocks.signup.mockResolvedValueOnce({ error: null, data: { user: { id: "new-user" }, session: null } });
    const close = setup(); submit();
    await screen.findByRole("alert"); expect(close).not.toHaveBeenCalled();
    submit(); await screen.findByRole("status"); expect(mocks.signup).toHaveBeenCalledTimes(2);
  });
  it("catches network rejection, clears pending and permits retry", async () => {
    mocks.signup.mockRejectedValueOnce(new Error("Failed to fetch"));
    setup(); submit(); await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Register" })).toBeEnabled();
  });
  it("requires a returned account before showing success", async () => {
    mocks.signup.mockResolvedValue({ error: null, data: { user: null, session: null } });
    setup(); submit(); await screen.findByRole("alert"); expect(screen.queryByRole("status")).toBeNull();
  });
  it("normalizes email, retains confirmation and defers Trade to explicit validated application handoff", async () => {
    mocks.signup.mockResolvedValue({ error: null, data: { user: { id: "new-user" }, session: null } });
    const close = setup(); fireEvent.click(screen.getByRole("radio", { name: "Yes" })); submit();
    await screen.findByRole("status");
    expect(mocks.signup).toHaveBeenCalledWith(expect.objectContaining({ email: "signup@example.com" }));
    expect(close).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled(); expect(mocks.invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Complete Trade application" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith(expect.stringContaining("intent=apply")));
  });
});