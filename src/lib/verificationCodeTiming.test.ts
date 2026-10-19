import { describe, expect, it } from "vitest";
import { CODE_LIFETIME_MS, RESEND_WAIT_MS, formatCountdown } from "./verificationCodeTiming";

describe("verification code timing", () => {
  it("codes last 10 minutes", () => expect(CODE_LIFETIME_MS).toBe(600000));
  it("resend waits 45 seconds", () => expect(RESEND_WAIT_MS).toBe(45000));
  it("formats countdowns", () => {
    expect(formatCountdown(600000)).toBe("10:00");
    expect(formatCountdown(44100)).toBe("0:45");
    expect(formatCountdown(-5)).toBe("0:00");
  });
});
