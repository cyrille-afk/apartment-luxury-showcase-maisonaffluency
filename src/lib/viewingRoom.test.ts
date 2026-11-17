import { describe, expect, it } from "vitest";
import { viewingRoomSchema, viewingRoomCamera, viewingRoomLeadTime } from "./viewingRoom";
describe("guest viewing room", () => {
  it("strips private account fields and token", () => {
    const result = viewingRoomSchema.parse({ name: "Developer", logo: null, hero: null, project_name: "Residence", layouts: [], access_token: "private", user_id: "private", trade_price_cents: 900 });
    expect(result).not.toHaveProperty("access_token"); expect(result).not.toHaveProperty("user_id"); expect(result).not.toHaveProperty("trade_price_cents");
  });
  it("keeps both preset cameras at eye-level", () => { expect(viewingRoomCamera("living", 8, 6).position[1]).toBe(1.6); expect(viewingRoomCamera("terrace", 8, 6).position[1]).toBe(1.6); expect(viewingRoomCamera("living", 8, 6)).not.toEqual(viewingRoomCamera("terrace", 8, 6)); });
  it("shows recorded lead times without inventing missing estimates", () => { expect(viewingRoomLeadTime(16)).toBe("16 weeks"); expect(viewingRoomLeadTime(null)).toBe("To be confirmed"); });
});