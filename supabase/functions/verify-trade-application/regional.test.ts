import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  AUTO_APPROVE_AT,
  MALFORMED_ID_CEILING,
  countryCode,
  credentialGuidance,
  decideVerification,
  regionFor,
  validateIdentifiers,
} from "./regional.ts";
import { MOCK_DOCUMENTS } from "./mockDocuments.ts";

const doc = (id: string) => {
  const found = MOCK_DOCUMENTS.find((d) => d.id === id);
  if (!found) throw new Error(`missing mock document: ${id}`);
  return found;
};

// ── Region mapping ───────────────────────────────────────────────────
Deno.test("regionFor maps SG/ASEAN, GCC and rest of world", () => {
  assertEquals(regionFor("Singapore"), "SG_ASEAN");
  assertEquals(regionFor("SG"), "SG_ASEAN");
  assertEquals(regionFor("Malaysia"), "SG_ASEAN");
  assertEquals(regionFor("United Arab Emirates"), "GCC");
  assertEquals(regionFor("Dubai"), "GCC");
  assertEquals(regionFor("Saudi Arabia"), "GCC");
  assertEquals(regionFor("Qatar"), "GCC");
  assertEquals(regionFor("United Kingdom"), "ROW");
  assertEquals(regionFor(""), "ROW");
  assertEquals(countryCode("KSA"), "SA");
});

Deno.test("credentialGuidance leads with the applicant's own region", () => {
  const sg = credentialGuidance("Singapore");
  assertEquals(sg.includes("region: SG_ASEAN"), true);
  assertEquals(sg.indexOf("SIDAC") < sg.indexOf("DED / DET trade licence"), true);

  const ae = credentialGuidance("United Arab Emirates");
  assertEquals(ae.includes("region: GCC"), true);
  assertEquals(ae.indexOf("APID") < ae.indexOf("SIDAC"), true);

  // The equal-weight scoring rule must always be present.
  for (const c of ["Singapore", "United Arab Emirates", "United Kingdom"]) {
    assertEquals(credentialGuidance(c).includes("MUST be 85 or above"), true);
  }
});

// ── Singapore UEN ────────────────────────────────────────────────────
Deno.test("Singapore UEN parsing accepts both national formats", () => {
  const d = doc("sg-acra-valid");
  const [uen] = validateIdentifiers(d.extractedIdentifiers, d.country);
  assertEquals(uen.type, "Singapore UEN");
  assertEquals(uen.valid, true);

  const alt = doc("sg-sidac-valid-alt-format");
  assertEquals(validateIdentifiers(alt.extractedIdentifiers, alt.country)[0].valid, true);

  // Business (8 digits + letter) and local-company (9 digits + letter) forms.
  assertEquals(
    validateIdentifiers([{ type: "Singapore UEN", value: "53312345M" }], "SG")[0].valid,
    true,
  );
  // Noise-tolerant: prefixes and spacing are normalised away.
  assertEquals(
    validateIdentifiers([{ type: "ACRA UEN Number", value: "UEN: 2018 34567 K" }], "SG")[0].valid,
    true,
  );
});

Deno.test("Singapore UEN parsing flags malformed numbers", () => {
  const d = doc("sg-uen-malformed");
  const [uen] = validateIdentifiers(d.extractedIdentifiers, d.country);
  assertEquals(uen.valid, false);
  assertEquals(uen.note.startsWith("Suspicious format"), true);

  for (const bad of ["20183456", "201834567", "T14L0123B", "ABCDEFGHI"]) {
    assertEquals(
      validateIdentifiers([{ type: "Singapore UEN", value: bad }], "Singapore")[0].valid,
      false,
      `expected ${bad} to be rejected`,
    );
  }
});

// ── UAE TRN / DED trade licence ──────────────────────────────────────
Deno.test("UAE DED licence and TRN parse from one document", () => {
  const d = doc("ae-ded-trn-valid");
  const ids = validateIdentifiers(d.extractedIdentifiers, d.country);
  assertEquals(ids.length, 2);
  assertEquals(ids[0].type, "UAE Trade Licence");
  assertEquals(ids[0].valid, true);
  assertEquals(ids[1].type, "UAE / GCC TRN");
  assertEquals(ids[1].valid, true);
});

Deno.test("UAE TRN must be exactly 15 digits", () => {
  const d = doc("ae-trn-malformed");
  assertEquals(validateIdentifiers(d.extractedIdentifiers, d.country)[0].valid, false);
  assertEquals(
    validateIdentifiers([{ type: "Tax Registration Number", value: "1002345678900031" }], "AE")[0]
      .valid,
    false,
  );
  assertEquals(
    validateIdentifiers([{ type: "UAE TRN", value: "100234567890003" }], "AE")[0].valid,
    true,
  );
});

// ── GCC CR / VAT ─────────────────────────────────────────────────────
Deno.test("Saudi CR and VAT numbers validate structurally", () => {
  const d = doc("sa-cr-valid");
  const ids = validateIdentifiers(d.extractedIdentifiers, d.country);
  assertEquals(ids[0].type, "Saudi CR Number");
  assertEquals(ids[0].valid, true);
  assertEquals(ids[1].type, "Saudi VAT Number");
  assertEquals(ids[1].valid, true);
});

Deno.test("Saudi CR rejects an out-of-range leading digit", () => {
  const d = doc("sa-cr-malformed");
  const [cr] = validateIdentifiers(d.extractedIdentifiers, d.country);
  assertEquals(cr.valid, false);
  assertEquals(cr.note.includes("1, 2, 4 or 7"), true);
});

Deno.test("Qatar GCC TRN parses via the shared 15-digit rule", () => {
  const d = doc("qa-gcc-trn-valid");
  const [trn] = validateIdentifiers(d.extractedIdentifiers, d.country);
  assertEquals(trn.valid, true);
});

Deno.test("Rest-of-world identifiers still validate where a rule exists", () => {
  const d = doc("row-riba-no-identifier");
  const [vat] = validateIdentifiers(d.extractedIdentifiers, d.country);
  assertEquals(vat.type, "UK VAT Number");
  assertEquals(vat.valid, true);

  // Unknown identifier types are neutral, never a false flag.
  const unknown = validateIdentifiers([{ type: "Chamber Membership", value: "XYZ" }], "France")[0];
  assertEquals(unknown.valid, null);
});

Deno.test("every mock document matches its expected validity", () => {
  for (const d of MOCK_DOCUMENTS) {
    const ids = validateIdentifiers(d.extractedIdentifiers, d.country);
    const allValid = ids.every((i) => i.valid === true);
    assertEquals(allValid, d.expectAllValid, `mock ${d.id}`);
    // Every extracted identifier value must appear in the source OCR text.
    for (const raw of d.extractedIdentifiers) {
      assertEquals(d.ocrText.includes(raw.value), true, `${d.id}: ${raw.value} not in OCR text`);
    }
  }
});

// ── Confidence thresholds ────────────────────────────────────────────
Deno.test("threshold: >= 85 auto-approves, < 85 goes to triage", () => {
  assertEquals(AUTO_APPROVE_AT, 85);
  assertEquals(decideVerification(92, []).status, "approved");
  assertEquals(decideVerification(85, []).status, "approved");
  assertEquals(decideVerification(84, []).status, "flagged_for_review");
  assertEquals(decideVerification(84, []).autoApprove, false);
  assertEquals(decideVerification(0, []).status, "flagged_for_review");
});

Deno.test("threshold: scores are clamped and rounded", () => {
  assertEquals(decideVerification(140, []).confidenceScore, 100);
  assertEquals(decideVerification(-20, []).confidenceScore, 0);
  assertEquals(decideVerification("84.6", []).confidenceScore, 85);
  assertEquals(decideVerification(undefined, []).confidenceScore, 0);
  assertEquals(decideVerification(null, []).status, "flagged_for_review");
});

Deno.test("threshold: a malformed corporate ID caps confidence at 70", () => {
  const d = doc("sg-uen-malformed");
  const ids = validateIdentifiers(d.extractedIdentifiers, d.country);
  const decision = decideVerification(97, ids);
  assertEquals(decision.rawScore, 97);
  assertEquals(decision.confidenceScore, MALFORMED_ID_CEILING);
  assertEquals(decision.status, "flagged_for_review");
  assertEquals(decision.malformed.length, 1);
});

Deno.test("threshold: a valid regional credential at 85 is approved end to end", () => {
  for (const id of ["sg-acra-valid", "ae-ded-trn-valid", "sa-cr-valid", "qa-gcc-trn-valid"]) {
    const d = doc(id);
    const ids = validateIdentifiers(d.extractedIdentifiers, d.country);
    const decision = decideVerification(85, ids);
    assertEquals(decision.status, "approved", `${id} should auto-approve at 85`);
    assertEquals(decision.malformed.length, 0, `${id} should have no malformed IDs`);
  }
});

Deno.test("threshold: malformed ID never lifts an already-low score", () => {
  const d = doc("ae-trn-malformed");
  const ids = validateIdentifiers(d.extractedIdentifiers, d.country);
  const decision = decideVerification(30, ids);
  assertEquals(decision.confidenceScore, 30);
  assertEquals(decision.status, "flagged_for_review");
});
