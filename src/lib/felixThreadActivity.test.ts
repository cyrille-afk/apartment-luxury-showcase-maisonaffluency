import { describe, expect, it } from "vitest";
import { felixThreadActivity, felixActivityTimestamp } from "./felixThreadActivity";

describe("Felix thread activity", () => {
  it("separates user submissions from assistant and automatic messages", () => {
    expect(felixThreadActivity([
      { kind: "msg", role: "user", content: "Find a chair" },
      { kind: "msg", role: "assistant", content: "Welcome" },
      { kind: "msg", role: "assistant", content: "Mood Board suggestions" },
      { kind: "proactive_tearsheet", data: {} },
      { kind: "pending_proposal" },
    ])).toEqual({ userMessages: 1, felixMessages: 2, savedCards: 1 });
  });
  it("ignores blank, malformed, and non-message timeline entries", () => {
    expect(felixThreadActivity([null, { kind: "msg", role: "user", content: " " }, { kind: "retry" }]))
      .toEqual({ userMessages: 0, felixMessages: 0, savedCards: 0 });
    expect(felixThreadActivity(null)).toEqual({ userMessages: 0, felixMessages: 0, savedCards: 0 });
  });
  it("does not fabricate an activity time for an invalid saved timestamp", () => {
    expect(felixActivityTimestamp("invalid")).toBeNull();
    expect(felixActivityTimestamp("2026-11-17T00:23:00Z")).toContain("2026");
  });
});