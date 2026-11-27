// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AiRenderPendingQueue, type PendingAxonometricRequest } from "./AiRenderPendingQueue";

const REQUESTS: PendingAxonometricRequest[] = [
  {
    id: "req-1",
    project_name: "Ecart 3D Render with Fabric/Finishes Test",
    request_type: "elevation",
    image_url: "https://example.com/ecart.png",
    status: "in_progress",
    created_at: "2026-06-17T09:00:10.314Z",
    notes: "Old test submission",
    profiles: { first_name: "Cyrille", last_name: "Delval", company: "Affluency" },
  },
  {
    id: "req-2",
    project_name: "Penthouse 3D Package",
    request_type: "3d_model",
    image_url: "https://example.com/model.zip",
    status: "pending",
    created_at: "2026-07-01T10:00:00.000Z",
    profiles: { first_name: "Alex", last_name: "Mercier", company: null },
  },
];

describe("AiRenderPendingQueue", () => {
  it("requires confirmation before deleting and cancels without deleting", () => {
    const onDelete = vi.fn(async () => true);
    render(
      <AiRenderPendingQueue
        requests={REQUESTS}
        activeRequestId={null}
        deletingId={null}
        onProcess={vi.fn()}
        onDownload3dModel={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Delete request Ecart 3D Render with Fabric/Finishes Test" }),
    );
    expect(screen.getByText("Delete render request?")).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("deletes the confirmed request and closes the confirmation dialog on success", async () => {
    const onDelete = vi.fn(async () => true);
    render(
      <AiRenderPendingQueue
        requests={REQUESTS}
        activeRequestId="req-1"
        deletingId={null}
        onProcess={vi.fn()}
        onDownload3dModel={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Delete request Ecart 3D Render with Fabric/Finishes Test" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Request" }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith(REQUESTS[0]);
    });
    await waitFor(() => {
      expect(screen.queryByText("Delete render request?")).toBeNull();
    });
  });

  it("keeps the confirmation dialog open for retry when deletion fails", async () => {
    const onDelete = vi.fn(async () => false);
    render(
      <AiRenderPendingQueue
        requests={REQUESTS}
        activeRequestId={null}
        deletingId={null}
        onProcess={vi.fn()}
        onDownload3dModel={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete request Penthouse 3D Package" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Request" }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(REQUESTS[1]);
    });
    expect(screen.getByText("Delete render request?")).toBeTruthy();
  });

  it("shows the empty state when no pending requests remain", () => {
    render(
      <AiRenderPendingQueue
        requests={[]}
        activeRequestId={null}
        deletingId={null}
        onProcess={vi.fn()}
        onDownload3dModel={vi.fn()}
        onDelete={vi.fn(async () => true)}
      />,
    );

    expect(screen.getByText("No pending requests — all caught up")).toBeTruthy();
  });

  it("narrows the list with the status filter", () => {
    render(
      <AiRenderPendingQueue
        requests={REQUESTS}
        activeRequestId={null}
        deletingId={null}
        onProcess={vi.fn()}
        onDownload3dModel={vi.fn()}
        onDelete={vi.fn(async () => true)}
      />,
    );

    expect(screen.getByText("2 requests")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "In Progress" }));

    expect(screen.getByText("1 of 2 shown")).toBeTruthy();
    expect(screen.getByText("Ecart 3D Render with Fabric/Finishes Test")).toBeTruthy();
    expect(screen.queryByText("Penthouse 3D Package")).toBeNull();
  });

  it("narrows the list with search and restores it when cleared", () => {
    render(
      <AiRenderPendingQueue
        requests={REQUESTS}
        activeRequestId={null}
        deletingId={null}
        onProcess={vi.fn()}
        onDownload3dModel={vi.fn()}
        onDelete={vi.fn(async () => true)}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Search pending requests" }), {
      target: { value: "penthouse" },
    });

    expect(screen.getByText("1 of 2 shown")).toBeTruthy();
    expect(screen.getByText("Penthouse 3D Package")).toBeTruthy();
    expect(screen.queryByText("Ecart 3D Render with Fabric/Finishes Test")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.getByText("2 requests")).toBeTruthy();
    expect(screen.getByText("Ecart 3D Render with Fabric/Finishes Test")).toBeTruthy();
  });

  it("offers to clear filters when nothing matches", () => {
    render(
      <AiRenderPendingQueue
        requests={REQUESTS}
        activeRequestId={null}
        deletingId={null}
        onProcess={vi.fn()}
        onDownload3dModel={vi.fn()}
        onDelete={vi.fn(async () => true)}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Search pending requests" }), {
      target: { value: "nothing here" },
    });

    expect(screen.getByText("No requests match these filters")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show all requests" }));

    expect(screen.getByText("2 requests")).toBeTruthy();
    expect(screen.getByText("Penthouse 3D Package")).toBeTruthy();
  });

  it("deletes a request found through the status filter", async () => {
    const onDelete = vi.fn(async () => true);
    render(
      <AiRenderPendingQueue
        requests={REQUESTS}
        activeRequestId={null}
        deletingId={null}
        onProcess={vi.fn()}
        onDownload3dModel={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete request Penthouse 3D Package" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Request" }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith(REQUESTS[1]);
    });
  });
});