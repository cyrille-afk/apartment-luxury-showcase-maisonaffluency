import { expect, it } from "vitest";
import { quoteShipToFromClient } from "./quoteShipTo";

const profile = {
  companyName: "Alternative Capital Enterprises Pte Ltd", clientName: "Cyrille Delval", email: "client@example.com",
  corporateAddress: { line1: "10 Corporate Road", line2: "#02-01", city: "Singapore", region: "Central", postalCode: "123456", country: "SG" },
};
it("checked toggle maps corporate company and all address fields into ship-to", () => {
  expect(quoteShipToFromClient(true, profile)).toEqual({
    name: "Alternative Capital Enterprises Pte Ltd", attention: "Cyrille Delval", email: "client@example.com", phone: "", notes: "",
    address1: "10 Corporate Road", address2: "#02-01", city: "Singapore", state: "Central", postal_code: "123456", country: "SG",
  });
});
it("unchecked toggle clears every ship-to input for manual entry", () => {
  expect(quoteShipToFromClient(false, profile)).toEqual({
    name: "", attention: "", email: "", phone: "", notes: "", address1: "", address2: "", city: "", state: "", postal_code: "", country: "",
  });
});
it("missing optional address fields stay blank rather than borrowing another address", () => {
  expect(quoteShipToFromClient(true, { email: "client@example.com" }).address1).toBe("");
});