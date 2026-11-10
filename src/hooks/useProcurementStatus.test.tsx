import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useProcurementStatus } from "./useProcurementStatus";

const store = vi.hoisted(() => ({ row: { id: "quote-a", status: "draft", procurement_issued_at: null as string | null, project_board_id: "folder-a" } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { ...store.row }, error: null }) }) }) }) } }));

describe("shared folder/quote issuance state", () => {
  it("updates both consumers immediately and survives remount from saved state", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const builder = renderHook(() => useProcurementStatus("quote-a"), { wrapper });
    const folder = renderHook(() => useProcurementStatus("quote-a"), { wrapper });
    await waitFor(() => expect(builder.result.current.data?.status).toBe("draft"));
    expect(folder.result.current.state).toBe("DRAFT");
    store.row = { ...store.row, status: "submitted", procurement_issued_at: "2026-11-10T13:17:00Z" };
    act(() => builder.result.current.acceptIssued({ ...store.row }));
    await waitFor(() => {
      expect(builder.result.current.state).toBe("PROCUREMENT_REVIEW");
      expect(folder.result.current.state).toBe("PROCUREMENT_REVIEW");
    });
    folder.unmount();
    const reopened = renderHook(() => useProcurementStatus("quote-a"), { wrapper });
    await waitFor(() => expect(reopened.result.current.state).toBe("PROCUREMENT_REVIEW"));
    builder.unmount(); reopened.unmount();
  });
});