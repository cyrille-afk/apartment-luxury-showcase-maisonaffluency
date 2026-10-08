import { describe, it, expect } from "vitest";
import { buildRecipientReports, isAdminAlertTemplate } from "./emailDeliverability";

const row = (id: string, email: string, status: string, at: string, err: string | null = null) => ({
  message_id: id, template_name: "studio-activation-alert", recipient_email: email, status, error_message: err, created_at: at,
});

describe("email deliverability", () => {
  it("dedupes by message and counts a pending→sent email once as sent", () => {
    const [r] = buildRecipientReports([row("m1", "a@x.com", "pending", "2026-10-08T10:00:00Z"), row("m1", "a@x.com", "sent", "2026-10-08T10:00:05Z")], []);
    expect(r.total).toBe(1);
    expect(r.sent).toBe(1);
    expect(r.verdict).toBe("healthy");
  });
  it("flags bounce and complaint suppressions", () => {
    const rows = [row("m1", "b@x.com", "suppressed", "2026-10-08T10:00:00Z"), row("m2", "c@x.com", "sent", "2026-10-08T10:00:00Z")];
    const reps = buildRecipientReports(rows, [
      { email: "b@x.com", reason: "bounce", created_at: "" },
      { email: "C@x.com", reason: "complaint", created_at: "" },
    ]);
    expect(reps.find((r) => r.email === "b@x.com")!.verdict).toBe("bouncing");
    expect(reps.find((r) => r.email === "c@x.com")!.verdict).toBe("spam_complaint");
  });
  it("flags dead-lettered and stuck pending emails", () => {
    const now = Date.parse("2026-10-08T12:00:00Z");
    const reps = buildRecipientReports([
      row("m1", "d@x.com", "dlq", "2026-10-08T11:00:00Z", "timeout"),
      row("m2", "e@x.com", "pending", "2026-10-08T11:00:00Z"),
    ], [], now);
    expect(reps.find((r) => r.email === "d@x.com")!.verdict).toBe("failing");
    expect(reps.find((r) => r.email === "e@x.com")!.verdict).toBe("stuck");
  });
  it("treats alerts and internal copies as admin templates", () => {
    expect(isAdminAlertTemplate("studio-activation-alert")).toBe(true);
    expect(isAdminAlertTemplate("approval-copy-gregoire")).toBe(true);
    expect(isAdminAlertTemplate("trade-approval")).toBe(false);
  });
});
