import { describe, expect, it } from "vitest";
import { parseProjectStagingMessage, PROJECT_STAGING_MESSAGE } from "./projectStagingMessage";

const payload = {
  productId: "11111111-1111-4111-8111-111111111111",
  productName: "Ondas Sconce",
  designer: "Alexander Lamont",
  selectedMaterial: "Bronze Patina",
  targetWorkflow: "Hamptons Project",
  timestamp: new Date().toISOString(),
  stagedBy: "Cyrille Delval",
  projectId: "22222222-2222-4222-8222-222222222222",
  boardItemId: "33333333-3333-4333-8333-333333333333",
};

describe("project staging message validation", () => {
  it("accepts a complete typed staging notification", () => {
    expect(parseProjectStagingMessage({ type: PROJECT_STAGING_MESSAGE, payload })).toEqual(payload);
  });
  it("rejects unrelated, malformed, and stale messages", () => {
    expect(parseProjectStagingMessage({ type: "other", payload })).toBeNull();
    expect(parseProjectStagingMessage({ type: PROJECT_STAGING_MESSAGE, payload: { ...payload, productId: "bad" } })).toBeNull();
    expect(parseProjectStagingMessage({ type: PROJECT_STAGING_MESSAGE, payload: { ...payload, boardItemId: undefined } })).toBeNull();
    expect(parseProjectStagingMessage({ type: PROJECT_STAGING_MESSAGE, payload: { ...payload, timestamp: "2020-01-01" } })).toBeNull();
  });
});