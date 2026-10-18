import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import PairingChangeHistory from "./PairingChangeHistory";

const mocks = vi.hoisted(() => ({ range: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ order: () => ({ order: () => ({ range: mocks.range }) }) }) }) } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const rows = [
  { id: "photo", action: "updated", actor_id: "a", actor_name: "Alice", actor_email: "", created_at: new Date(2026, 9, 18, 12).toISOString(), before_values: { preferred_pick_id: "console" }, after_values: { preferred_pick_id: "console", finish_media: [{ key: "custom:oak", label: "Oak", product_image_url: "https://assets.example/oak.jpg" }] } },
  { id: "texture", action: "updated", actor_id: "b", actor_name: "Bob", actor_email: "", created_at: new Date(2026, 9, 19, 12).toISOString(), before_values: { preferred_pick_id: "lamp" }, after_values: { preferred_pick_id: "lamp", finish_media: [{ key: "custom:brass", label: "Brass", macro_image_url: "https://assets.example/brass.jpg" }] } },
];
async function open() {
  mocks.range.mockResolvedValue({ data: rows, error: null });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PairingChangeHistory products={[{ id: "console", title: "Console", brand: "Atelier" }, { id: "lamp", title: "Lamp", brand: "Studio" }]} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Change history" }));
  await screen.findByText("2 matching records");
}
async function select(label: string, option: string) {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("option", { name: option, exact: true }));
}
describe("catalog history filter interactions", () => {
  it("combines product and media selections and clears back to all records", async () => {
    await open();
    await select("Product", "Atelier — Console");
    await select("Change type", "Finish images");
    expect(screen.getByText("1 matching record")).toBeInTheDocument();
    expect(screen.getByText("Oak · product photo")).toBeInTheDocument();
    expect(screen.queryByText("Brass · macro texture")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("2 matching records")).toBeInTheDocument();
  });
  it("filters recorded admins with date bounds and exposes no-result recovery", async () => {
    await open();
    await select("Admin", "Bob");
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-19" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-10-19" } });
    expect(screen.getByText("1 matching record")).toBeInTheDocument();
    expect(screen.getByText("Brass · macro texture")).toBeInTheDocument();
    await select("Change type", "Finish images");
    expect(screen.getByText("No changes match these filters.")).toBeInTheDocument();
  });
  it("resets pagination when filters change", async () => {
    await open();
    cleanup();
    mocks.range.mockResolvedValue({ data: Array.from({ length: 51 }, (_, index) => ({ ...rows[0], id: String(index) })), error: null });
    render(<QueryClientProvider client={new QueryClient()}><PairingChangeHistory products={[{ id: "console", title: "Console", brand: "Atelier" }]} /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Change history" }));
    await screen.findByText("51 matching records");
    fireEvent.click(screen.getByRole("button", { name: "Older" }));
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    await select("Change type", "Finish images");
    expect(screen.getByText("Page 1")).toBeInTheDocument();
  });
});