import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CheckoutFormProvider } from "@/contexts/CheckoutFormContext";
import { rememberPrivateClient } from "@/lib/returningPrivateClient";
import OrderIntakeSheet from "./OrderIntakeSheet";

vi.mock("@/lib/cartTracking", () => ({ setCartContact: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn(), dismiss: vi.fn() }) }));
vi.mock("@/components/Turnstile", () => ({ default: () => null }));
vi.mock("./PhoneDialField", () => ({ default: () => null }));
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(cleanup);

it("welcomes the returning private email only, keeps three steps and completes normally", () => {
  rememberPrivateClient("client@example.com", "private");
  const complete = vi.fn();
  render(<CheckoutFormProvider><OrderIntakeSheet isOpen onClose={vi.fn()} onComplete={complete} /></CheckoutFormProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Private Client" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(complete).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Project Location (City)"), { target: { value: "Singapore" } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "CLIENT@example.com" } });
  expect(screen.getByRole("status")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "new@example.com" } });
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "client@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Place Order" }));
  expect(complete).toHaveBeenCalledWith(expect.objectContaining({ email: "client@example.com", profile: "private", city: "Singapore" }));
});