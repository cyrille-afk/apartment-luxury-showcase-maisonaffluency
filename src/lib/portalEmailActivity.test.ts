import { describe, expect, it } from "vitest";
import {
  buildPortalStats,
  filterAccountsByPortalActivity,
  portalFilterCounts,
  type PortalLinkRow,
} from "./portalEmailActivity";

const row = (
  email: string,
  click_count: number,
  last_clicked_at: string | null = null,
): PortalLinkRow => ({ recipient_email: email, click_count, last_clicked_at });

const accounts = [
  { email: "Opened@Studio.test" },
  { email: "silent@studio.test" },
  { email: "never-emailed@studio.test" },
];

describe("buildPortalStats", () => {
  it("sums clicks per studio and keeps the most recent click", () => {
    const stats = buildPortalStats([
      row("A@Studio.test", 2, "2026-10-01T10:00:00Z"),
      row("a@studio.test", 3, "2026-10-05T09:00:00Z"),
      row("a@studio.test", 1, "2026-10-03T09:00:00Z"),
    ]);
    expect(stats.clicked["a@studio.test"]).toEqual({
      count: 6,
      last: "2026-10-05T09:00:00Z",
    });
    expect(stats.sent.has("a@studio.test")).toBe(true);
  });

  it("treats a zero-click link as sent but not opened", () => {
    const stats = buildPortalStats([row("silent@studio.test", 0)]);
    expect(stats.sent.has("silent@studio.test")).toBe(true);
    expect(stats.clicked["silent@studio.test"]).toBeUndefined();
  });

  it("ignores blank addresses", () => {
    const stats = buildPortalStats([row("   ", 4, "2026-10-01T10:00:00Z")]);
    expect(stats.sent.size).toBe(0);
    expect(Object.keys(stats.clicked)).toHaveLength(0);
  });
});

describe("filterAccountsByPortalActivity", () => {
  const stats = buildPortalStats([
    row("opened@studio.test", 1, "2026-10-02T08:00:00Z"),
    row("silent@studio.test", 0),
  ]);

  it("keeps every application when the filter is off", () => {
    expect(filterAccountsByPortalActivity(accounts, stats, "all")).toHaveLength(3);
  });

  it("returns only studios that opened the portal from an email", () => {
    expect(filterAccountsByPortalActivity(accounts, stats, "opened")).toEqual([
      { email: "Opened@Studio.test" },
    ]);
  });

  it("returns emailed-but-unopened studios, excluding those never emailed", () => {
    expect(filterAccountsByPortalActivity(accounts, stats, "not_opened")).toEqual([
      { email: "silent@studio.test" },
    ]);
  });
});

describe("portalFilterCounts", () => {
  it("counts opened and not-opened studios without double counting", () => {
    const stats = buildPortalStats([
      row("opened@studio.test", 4, "2026-10-02T08:00:00Z"),
      row("silent@studio.test", 0),
    ]);
    expect(portalFilterCounts(accounts, stats)).toEqual({ opened: 1, notOpened: 1 });
  });

  it("returns zeroes when no tracked email was sent", () => {
    expect(portalFilterCounts(accounts, buildPortalStats([]))).toEqual({
      opened: 0,
      notOpened: 0,
    });
  });
});
