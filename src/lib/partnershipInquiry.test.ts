import { expect, it } from "vitest";
import {
  PARTNERSHIP_HONEYPOT_FIELD,
  validatePartnershipInquiry,
} from "./partnershipInquiry";

const valid = {
  name: "Alexandra Chen",
  company: "Cipriani Residences",
  email: "alexandra@cipriani.com",
  phone: "+1 305 123 4567",
  project: "Canaletto Penthouse",
  message: "We would like to discuss a furnished-residence package for our Miami tower.",
};

it("accepts a complete inquiry and trims its values", () => {
  const result = validatePartnershipInquiry({ ...valid, name: "  Alexandra Chen  " });
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.data.name).toBe("Alexandra Chen");
});

it("fills optional fields with empty strings instead of leaving them undefined", () => {
  const result = validatePartnershipInquiry({ name: "Alexandra", email: "a@b.com", message: "Hello, we would like to talk." });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.data.company).toBe("");
    expect(result.data.phone).toBe("");
    expect(result.data.project).toBe("");
  }
});

it("rejects a missing name, a bad email and a too-short message", () => {
  const missingName = validatePartnershipInquiry({ ...valid, name: "   " });
  expect(missingName.ok).toBe(false);
  if (!missingName.ok) expect(missingName.errors.name).toBeTruthy();

  const badEmail = validatePartnershipInquiry({ ...valid, email: "not-an-email" });
  expect(badEmail.ok).toBe(false);
  if (!badEmail.ok) expect(badEmail.errors.email).toBeTruthy();

  const shortMessage = validatePartnershipInquiry({ ...valid, message: "Hi" });
  expect(shortMessage.ok).toBe(false);
  if (!shortMessage.ok) expect(shortMessage.errors.message).toBeTruthy();
});

it("rejects values over the stored field limits", () => {
  const tooLongName = validatePartnershipInquiry({ ...valid, name: "n".repeat(101) });
  expect(tooLongName.ok).toBe(false);
  if (!tooLongName.ok) expect(tooLongName.errors.name).toBeTruthy();

  const tooLongMessage = validatePartnershipInquiry({ ...valid, message: "m".repeat(2001) });
  expect(tooLongMessage.ok).toBe(false);
  if (!tooLongMessage.ok) expect(tooLongMessage.errors.message).toBeTruthy();
});

it("treats a filled trap field as automated and stores nothing", () => {
  const result = validatePartnershipInquiry({ ...valid, [PARTNERSHIP_HONEYPOT_FIELD]: "http://spam.example" });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.spam).toBe(true);
    expect(result.errors).toEqual({});
  }
});

it("leaves an empty trap field harmless", () => {
  const result = validatePartnershipInquiry({ ...valid, [PARTNERSHIP_HONEYPOT_FIELD]: "   " });
  expect(result.ok).toBe(true);
});

it("rejects payloads that are not an object without throwing", () => {
  for (const payload of [null, undefined, "hello", 42, []]) {
    const result = validatePartnershipInquiry(payload);
    expect(result.ok).toBe(false);
  }
});
