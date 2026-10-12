import { describe, expect, it } from "vitest";
import { clientLocationDetails } from "./clientLocation";

describe("Client Management location display", () => {
  it("shows persisted IP currency without changing preferred currency", () => {
    expect(clientLocationDetails({ billing_country: 'France', default_currency: 'EUR', ip_detected_country: 'SG', ip_detected_currency: 'SGD' }, 'US')).toMatchObject({ currency: 'EUR', ipCountry: 'SG', ipCurrency: 'SGD' });
  });
  it("shows country-based currency when no default was saved", () => {
    expect(clientLocationDetails({ billing_country: "Singapore" })).toMatchObject({
      country: "Singapore", countryCurrency: "SGD", currency: "SGD", ipCurrency: null,
    });
  });
  it("keeps actual IP detection separate from the profile country", () => {
    expect(clientLocationDetails({ billing_country: "France" }, "US")).toMatchObject({
      country: "France", countryCurrency: "EUR", ipCurrency: "USD",
    });
  });
  it("does not invent an IP currency when none was recorded", () => {
    expect(clientLocationDetails({ billing_country: "United Kingdom" }).ipCurrency).toBeNull();
  });
  it("preserves saved currency without modifying profile data", () => {
    const profile = { billing_country: "Singapore", default_currency: "EUR" };
    expect(clientLocationDetails(profile, "GB")).toMatchObject({ currency: "EUR", countryCurrency: "SGD", ipCurrency: "GBP" });
    expect(profile).toEqual({ billing_country: "Singapore", default_currency: "EUR" });
  });
  it("leaves unknown and missing locations unavailable", () => {
    expect(clientLocationDetails({}, "ZZ")).toMatchObject({ country: null, currency: null, ipCurrency: null });
  });
  it("resolves country codes to their display country", () => {
    expect(clientLocationDetails({ billing_country: " sg " })).toMatchObject({ country: "Singapore", currency: "SGD" });
  });
});