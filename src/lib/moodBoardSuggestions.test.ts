import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeWithAuthRetry } from "./invokeWithAuthRetry";
import { loadMoodBoardSuggestions } from "./moodBoardSuggestions";

vi.mock("./invokeWithAuthRetry", () => ({ invokeWithAuthRetry: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

describe("automatic Mood Board suggestions", () => {
  it("returns complements to the separate panel without emitting Felix events", async () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const suggestions = [{ product_id: "table", title: "Accent table", reason: "Pairs with the chair" }];
    vi.mocked(invokeWithAuthRetry).mockResolvedValue({ data: { recommendations: suggestions }, error: null } as any);

    const result = await loadMoodBoardSuggestions(["chair"], { anchorIds: ["chair", "other-room"], roomType: "Living room", projectId: "project" });

    expect(result).toEqual(suggestions);
    expect(dispatch).not.toHaveBeenCalled();
    expect(invokeWithAuthRetry).toHaveBeenCalledWith("board-recommendations", {
      product_ids: ["chair"], anchor_ids: ["chair"], room_type: "Living room",
      source: "project_tearsheet_mood_board", project_id: "project", include_pool: true,
    });
  });

  it("keeps failed automatic suggestions out of Felix too", async () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const error = new Error("Suggestions unavailable");
    vi.mocked(invokeWithAuthRetry).mockResolvedValue({ data: null, error } as any);
    await expect(loadMoodBoardSuggestions(["chair"], { anchorIds: [], roomType: "Living room", projectId: null })).rejects.toThrow(error);
    expect(dispatch).not.toHaveBeenCalled();
  });
});