import { beforeEach, describe, expect, it } from "vitest";
import { isReturningPrivateClient, rememberedPrivateClients, rememberPrivateClient } from "./returningPrivateClient";

beforeEach(() => localStorage.clear());
describe("returning private clients", () => {
  it("recognizes a previous private basket email ignoring case and spaces", () => {
    rememberPrivateClient(" Client@Example.com ", "private");
    expect(isReturningPrivateClient("CLIENT@example.com", "private", rememberedPrivateClients())).toBe(true);
  });
  it("retains recognition after a purchase empties the basket", () => {
    rememberPrivateClient("client@example.com", "private");
    localStorage.setItem("ma_cart_v1", "[]");
    localStorage.setItem("ma_cart_order_placed", "1");
    expect(isReturningPrivateClient("client@example.com", "private", rememberedPrivateClients())).toBe(true);
  });
  it("never recognizes a new email simply because it was entered", () => {
    const prior = rememberedPrivateClients();
    localStorage.setItem("ma_checkout_form", JSON.stringify({ email: "new@example.com", buyerProfile: "private" }));
    expect(isReturningPrivateClient("new@example.com", "private", prior)).toBe(false);
    expect(rememberedPrivateClients().size).toBe(0);
  });
  it("does not welcome professionals or unrelated/invalid emails", () => {
    rememberPrivateClient("studio@example.com", "designer");
    rememberPrivateClient("client@example.com", "private");
    const prior = rememberedPrivateClients();
    expect(isReturningPrivateClient("studio@example.com", "private", prior)).toBe(false);
    expect(isReturningPrivateClient("client@example.com", "designer", prior)).toBe(false);
    expect(isReturningPrivateClient("other@example.com", "private", prior)).toBe(false);
    expect(isReturningPrivateClient("invalid", "private", prior)).toBe(false);
  });
  it("migrates private-client evidence from a legacy abandoned basket", () => {
    localStorage.setItem("ma_checkout_form", JSON.stringify({ email: "client@example.com", buyerProfile: "private" }));
    localStorage.setItem("ma_cart_v1_backup", JSON.stringify({ lines: [{ title: "Chair" }] }));
    expect(isReturningPrivateClient("client@example.com", "private", rememberedPrivateClients())).toBe(true);
  });
  it("handles malformed or unavailable stored recognition without stopping checkout", () => {
    localStorage.setItem("ma_private_client_visits_v1", "null");
    localStorage.setItem("ma_checkout_form", "null");
    expect(rememberedPrivateClients().size).toBe(0);
    rememberPrivateClient("not an email", "private");
    expect(rememberedPrivateClients().size).toBe(0);
  });
});