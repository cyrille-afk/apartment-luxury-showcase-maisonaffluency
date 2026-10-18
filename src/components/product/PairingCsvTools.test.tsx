import { act, fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PairingCsvTools from "./PairingCsvTools";
import { exportPairingCsv } from "@/lib/curatedPairingCsv";
import type { PairingRule } from "@/lib/curatedPairings";

const mocks = vi.hoisted(() => ({ select: vi.fn(), rpc: vi.fn(), toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ in: mocks.select }) }), rpc: mocks.rpc } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
const rule: PairingRule = { id: "rule-1", source_category: "ceiling", target_category: "tables", preferred_pick_id: "pick-1", enabled: false, sort_order: 12, finish_currency: "USD", finish_options: [{ id: "f-1", name: "Oak", price_cents: 10000 }] };
const products = [{ id: "pick-1", title: "Console", brand: "Maker", category: "tables" }];
const onSaved = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.select.mockResolvedValue({ data: [rule], error: null });
  mocks.rpc.mockResolvedValue({ data: { updated_count: 1, batch_id: "batch-1" }, error: null });
});
afterEach(cleanup);
async function upload(csv: string) {
  const file = new File([csv], "finishes.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: async () => csv });
  await act(async () => { fireEvent.change(screen.getByLabelText("Import pairing finishes CSV"), { target: { files: [file] } }); });
}
describe("pairing CSV confirmation and persistence", () => {
  it("does not write during preview or cancellation", async () => {
    render(<PairingCsvTools rules={[rule]} products={products} disabled={false} onSaved={onSaved} />);
    await upload(exportPairingCsv([rule], new Map()));
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("writes confirmed finishes and prices once and preserves existing rule settings", async () => {
    render(<PairingCsvTools rules={[rule]} products={products} disabled={false} onSaved={onSaved} />);
    await upload(exportPairingCsv([{ ...rule, finish_options: [{ id: "f-1", name: "Écru Oak", price_cents: 8729 }] }], new Map()));
    fireEvent.click(screen.getByRole("button", { name: "Confirm 1 pairing updates" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("import_curated_pairing_finishes", { updates: [{ id: rule.id, before: rule, finish_currency: "USD", finish_options: [{ id: "f-1", name: "Écru Oak", price_cents: 8729 }] }], file_name: "finishes.csv" });
  });
  it("blocks invalid files without saving any pairing", async () => {
    render(<PairingCsvTools rules={[rule]} products={products} disabled={false} onSaved={onSaved} />);
    await upload(exportPairingCsv([{ ...rule, finish_currency: "ZZZ" }], new Map()));
    expect(screen.getByRole("button", { name: "Confirm 0 pairing updates" })).toBeDisabled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects a stale preview without overwriting newer catalog choices", async () => {
    mocks.select.mockResolvedValue({ data: [{ ...rule, finish_currency: "GBP" }], error: null });
    render(<PairingCsvTools rules={[rule]} products={products} disabled={false} onSaved={onSaved} />);
    await upload(exportPairingCsv([rule], new Map()));
    fireEvent.click(screen.getByRole("button", { name: "Confirm 1 pairing updates" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
  it("retains review after a failed save and never reports success", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("Access denied") });
    render(<PairingCsvTools rules={[rule]} products={products} disabled={false} onSaved={onSaved} />);
    await upload(exportPairingCsv([rule], new Map()));
    fireEvent.click(screen.getByRole("button", { name: "Confirm 1 pairing updates" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Import could not be saved" })));
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
  });
});