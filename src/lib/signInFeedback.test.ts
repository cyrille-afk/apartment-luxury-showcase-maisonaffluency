import { describe, expect, it } from "vitest";
import { signInErrorMessage } from "./signInFeedback";

describe("sign-in error classification", () => {
  it("separates rate limits from credential rejection", () => {
    expect(signInErrorMessage({ status: 429 })).not.toBe(signInErrorMessage({ status: 400 }));
  });
  it("separates confirmation requirements from credential rejection", () => {
    expect(signInErrorMessage({ code: "email_not_confirmed" })).not.toBe(signInErrorMessage({ code: "invalid_credentials" }));
  });
  it("separates temporary service failure from credential rejection", () => {
    expect(signInErrorMessage({ status: 503 })).not.toBe(signInErrorMessage({ status: 400 }));
  });
});