import { describe, it, expect } from "vitest";
import { uniqueCollaborators } from "./uniqueCollaborators";

describe("uniqueCollaborators", () => {
  it("keeps one badge per email and prefers the joined invite", () => {
    const out = uniqueCollaborators([
      { id: "a", email: "Client@x.com", status: "pending" },
      { id: "b", email: "client@x.com", status: "accepted" },
      { id: "c", email: "other@x.com", status: "pending" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe("b");
    expect(out[0].ids).toEqual(["a", "b"]);
  });
});
