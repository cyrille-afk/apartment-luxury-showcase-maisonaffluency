import { describe, expect, it } from "vitest";
import { bucketInviteActivity } from "./inviteActivity";

describe("bucketInviteActivity", () => {
  const now = new Date(2026, 10, 19, 12);
  it("counts each kind on its own day and keeps empty days", () => {
    const rows = [
      { kind: "attempt", created_at: new Date(2026, 10, 19, 9).toISOString() },
      { kind: "attempt", created_at: new Date(2026, 10, 19, 10).toISOString() },
      { kind: "sent", created_at: new Date(2026, 10, 19, 10).toISOString() },
      { kind: "validation_error", created_at: new Date(2026, 10, 17, 10).toISOString() },
    ];
    const days = bucketInviteActivity(rows, 3, now);
    expect(days.map(d => d.day)).toEqual(["2026-11-17", "2026-11-18", "2026-11-19"]);
    expect(days[2]).toMatchObject({ attempt: 2, sent: 1, validation_error: 0 });
    expect(days[0].validation_error).toBe(1);
    expect(days[1]).toMatchObject({ attempt: 0, sent: 0, validation_error: 0 });
  });
  it("ignores rows outside the window", () => {
    const days = bucketInviteActivity([{ kind: "attempt", created_at: new Date(2026, 9, 1).toISOString() }], 7, now);
    expect(days.reduce((n, d) => n + d.attempt, 0)).toBe(0);
  });
});
