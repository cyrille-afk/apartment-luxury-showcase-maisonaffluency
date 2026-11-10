import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import BoardFeedbackPanel from "./BoardFeedbackPanel";
afterEach(cleanup);
const entries = [{ id: "later", sender: "Client", reaction: null, comment: "Later decision", created_at: "2026-11-10T04:19:53Z" }, { id: "first", sender: "Client", reaction: "up", comment: "Original choice", created_at: "2026-11-10T04:19:04Z" }];
it("saves only the private draft through the existing note callback", async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  render(<BoardFeedbackPanel productName="Madison" entries={entries} note="Existing private note" onClose={() => {}} onSave={onSave} />);
  fireEvent.change(screen.getByLabelText("Internal Studio Notes (Private)"), { target: { value: "Private procurement note" } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith("Private procurement note"));
  expect(entries[0].comment).toBe("Later decision");
});
it("keeps the draft when saving fails so it can be retried", async () => {
  const onSave = vi.fn().mockResolvedValue(false);
  render(<BoardFeedbackPanel productName="Madison" entries={[]} note="" onClose={() => {}} onSave={onSave} />);
  fireEvent.change(screen.getByLabelText("Internal Studio Notes (Private)"), { target: { value: "Keep this draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith("Keep this draft"));
  expect((screen.getByLabelText("Internal Studio Notes (Private)") as HTMLTextAreaElement).value).toBe("Keep this draft");
});