import { describe, it, expect } from "vitest";
import { studioSaveErrorMessage } from "./studioCreationMessage";

describe("studioSaveErrorMessage", () => {
  it("flags access-rule blocks by code", () => {
    expect(studioSaveErrorMessage({ code: "42501", message: "x" }).blocked).toBe(true);
  });
  it("flags access-rule blocks by message", () => {
    expect(studioSaveErrorMessage({ message: "new row violates row-level security policy for table \"studios\"" }).blocked).toBe(true);
  });
  it("other failures are not access blocks", () => {
    expect(studioSaveErrorMessage({ message: "Failed to fetch" }).blocked).toBe(false);
  });
});
