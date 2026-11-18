import { describe, expect, it } from "vitest";
import { viewingRoomSchema, viewingRoomCamera, viewingRoomLeadTime, viewingRoomTotal, type ViewingRoomSlot } from "./viewingRoom";
describe("guest viewing room", () => {
  const original = { id: "slot", retail_price: 100, alternatives: [{ id: "replacement", retail_price: 150 }] } as ViewingRoomSlot;
  it("updates the package only by the approved retail difference", () => { expect(viewingRoomTotal(1000, [original], { slot: original.alternatives[0] })).toBe(1050); expect(viewingRoomTotal(1000, [original], {})).toBe(1000); });
  it("rejects unlinked alternatives rather than trusting submitted prices", () => { expect(() => viewingRoomTotal(1000, [original], { slot: { ...original.alternatives[0], id: "unapproved" } })).toThrow(); });
  it("strips private account fields and token", () => {
    const result = viewingRoomSchema.parse({ name: "Developer", logo: null, hero: null, project_name: "Residence", layouts: [], access_token: "private", user_id: "private", trade_price_cents: 900 });
    expect(result).not.toHaveProperty("access_token"); expect(result).not.toHaveProperty("user_id"); expect(result).not.toHaveProperty("trade_price_cents");
  });
  it("keeps both preset cameras at eye-level", () => { expect(viewingRoomCamera("living", 8, 6).position[1]).toBe(1.6); expect(viewingRoomCamera("terrace", 8, 6).position[1]).toBe(1.6); expect(viewingRoomCamera("living", 8, 6)).not.toEqual(viewingRoomCamera("terrace", 8, 6)); });
  it("keeps Overview at eye level with a wider retreat", () => { const pose = viewingRoomCamera("overview", 8, 6); expect(pose.position).toEqual([0, 1.6, 4.800000000000001]); expect(pose.target).toEqual([0, .75, 0]); });
  it("shows recorded lead times without inventing missing estimates", () => { expect(viewingRoomLeadTime(16)).toBe("16 weeks"); expect(viewingRoomLeadTime(null)).toBe("To be confirmed"); });
});