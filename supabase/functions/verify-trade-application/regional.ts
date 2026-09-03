// Hyper-localised credential intelligence for the Global Trade Program.
//
// Two jobs:
//   1. Tell the verification model WHICH credentials are legitimate for the
//      applicant's country (Singapore / ASEAN, GCC, Rest of World), so a valid
//      SIDAC certificate or DED trade licence is never treated as weaker
//      evidence than an ASID card.
//   2. Structurally validate the corporate identifiers the model extracts
//      (Singapore UEN, UAE/GCC TRN, Saudi CR, etc.) so malformed or invented
//      numbers are surfaced to the reviewer.

export type Region = "SG_ASEAN" | "GCC" | "ROW";

export type ExtractedIdentifier = {
  /** e.g. "Singapore UEN", "UAE TRN", "Saudi CR Number" */
  type: string;
  value: string;
  /** structural validation result */
  valid: boolean | null;
  /** short human explanation of the validation outcome */
  note: string;
};

const SG_ASEAN: Record<string, string> = {
  SG: "Singapore",
  MY: "Malaysia",
  ID: "Indonesia",
  TH: "Thailand",
  PH: "Philippines",
  VN: "Vietnam",
  BN: "Brunei",
  KH: "Cambodia",
  LA: "Laos",
  MM: "Myanmar",
};

const GCC: Record<string, string> = {
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  BH: "Bahrain",
  OM: "Oman",
};

const NAME_TO_CODE: Record<string, string> = {
  singapore: "SG",
  malaysia: "MY",
  indonesia: "ID",
  thailand: "TH",
  philippines: "PH",
  vietnam: "VN",
  "viet nam": "VN",
  brunei: "BN",
  cambodia: "KH",
  laos: "LA",
  myanmar: "MM",
  "united arab emirates": "AE",
  uae: "AE",
  dubai: "AE",
  "abu dhabi": "AE",
  "saudi arabia": "SA",
  ksa: "SA",
  qatar: "QA",
  kuwait: "KW",
  bahrain: "BH",
  oman: "OM",
};

export function countryCode(country?: string | null): string {
  const raw = (country || "").trim();
  if (!raw) return "";
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return NAME_TO_CODE[raw.toLowerCase()] || "";
}

export function regionFor(country?: string | null): Region {
  const code = countryCode(country);
  if (code in SG_ASEAN) return "SG_ASEAN";
  if (code in GCC) return "GCC";
  return "ROW";
}

/** Country-aware guidance injected into the verification prompt. */
export function credentialGuidance(country?: string | null): string {
  const code = countryCode(country);
  const region = regionFor(country);

  const singapore = `SINGAPORE — accept any of these as first-class proof:
  • SIDAC / SIDS accreditation certificate (Interior Designer Class 1, 2 or 3 — all valid).
  • Singapore Institute of Architects (SIA) membership number, or BCA / URA registration.
  • ACRA Business Profile (iShop/BizFile extract) naming the applicant as officer or shareholder.
  • Any official invoice, tenancy agreement or letterhead showing a valid Singapore UEN.
  A Singapore UEN looks like 53312345X (8 digits + letter), 201812345K (9 digits + letter) or T09LL0001B (letter + 2 digits + 2 letters + 4 digits + letter).`;

  const asean = `ASEAN — also accept national equivalents: Malaysia SSM/ROC registration or LAM/PAM membership, Indonesia NIB/HIMPUNAN DESAINER INTERIOR (HDII), Thailand DBD registration or ASA membership, Philippines PRC ID / PIID membership, Vietnam business registration certificate.`;

  const gcc = `MIDDLE EAST (GCC) — accept any of these as first-class proof:
  • APID (Association of Professional Interior Designers) certificate.
  • UAE: DED / DET trade licence (Dubai, Abu Dhabi DED, or free-zone licence such as DMCC, Dubai Design District), or a document carrying a 15-digit TRN.
  • Saudi Arabia: Commercial Registration (CR) number (10 digits) or Saudi VAT number (15 digits starting and ending with 3), Saudi Council of Engineers (SCE) membership.
  • Qatar / Kuwait / Bahrain / Oman: Commercial Registration certificate or a GCC Tax Registration Number (TRN).`;

  const row = `REST OF WORLD — accept recognised professional bodies (ASID, IIDA, NCIDQ, RIBA, ARB, AIA, BIID, IDC, Architects Registration boards, national chambers/ordres) or a verified commercial studio lease, company registration extract, or trade invoice on studio letterhead.`;

  const blocks = [
    region === "SG_ASEAN" ? (code === "SG" ? [singapore, asean] : [asean, singapore]) : [],
    region === "GCC" ? [gcc] : [],
    region === "ROW" ? [row] : [],
  ].flat();

  // Always append the other regions so a mis-stated country does not cause a
  // false flag, but keep the applicant's own region first.
  const others = [
    region !== "SG_ASEAN" ? `${singapore}\n${asean}` : "",
    region !== "GCC" ? gcc : "",
    region !== "ROW" ? row : "",
  ].filter(Boolean);

  return `ACCEPTED CREDENTIALS FOR THIS APPLICANT (${country || "unknown country"} — region: ${region})
${blocks.join("\n")}

OTHER ACCEPTED CREDENTIALS (for reference)
${others.join("\n")}

CRITICAL SCORING RULE: a localised Asian or Middle Eastern business certification (SIDAC/SIDS, SIA, ACRA/UEN, APID, DED trade licence, CR number, GCC TRN) that is legible, current and matches the company name is EQUAL in weight to a Western professional body. If such a document is clear and consistent, the confidence_score MUST be 85 or above. Do not penalise an applicant merely because the credential is unfamiliar, non-English, or regional.`;
}

// ── Structural validators ────────────────────────────────────────────
type Validator = { label: string; test: (v: string) => boolean; hint: string };

const VALIDATORS: Record<string, Validator> = {
  sg_uen: {
    label: "Singapore UEN",
    test: (v) =>
      /^\d{8}[A-Z]$/.test(v) || /^\d{9}[A-Z]$/.test(v) || /^[TSR]\d{2}[A-Z]{2}\d{4}[A-Z]$/.test(v),
    hint: "Expected 8 or 9 digits + checksum letter, or T/S/R + YY + 2 letters + 4 digits + letter.",
  },
  ae_trn: {
    label: "UAE / GCC TRN",
    test: (v) => /^\d{15}$/.test(v),
    hint: "Expected exactly 15 digits.",
  },
  gcc_trn: {
    label: "GCC TRN",
    test: (v) => /^\d{15}$/.test(v),
    hint: "Expected exactly 15 digits.",
  },
  sa_cr: {
    label: "Saudi CR Number",
    test: (v) => /^[1247]\d{9}$/.test(v),
    hint: "Expected 10 digits beginning with 1, 2, 4 or 7.",
  },
  sa_vat: {
    label: "Saudi VAT Number",
    test: (v) => /^3\d{13}3$/.test(v),
    hint: "Expected 15 digits starting and ending with 3.",
  },
  ae_trade_licence: {
    label: "UAE Trade Licence",
    test: (v) => /^[A-Z0-9-]{4,20}$/.test(v),
    hint: "Expected an alphanumeric DED / free-zone licence reference.",
  },
  my_ssm: {
    label: "Malaysia SSM Registration",
    test: (v) => /^\d{12}$/.test(v) || /^\d{6,7}-?[A-Z]$/.test(v),
    hint: "Expected 12 digits (new format) or 6-7 digits + letter (legacy).",
  },
  gb_vat: {
    label: "UK VAT Number",
    test: (v) => /^GB?\d{9}(\d{3})?$/.test(v),
    hint: "Expected GB + 9 digits.",
  },
};

function normalise(value: string): string {
  return (value || "").toUpperCase().replace(/[\s./]/g, "").replace(/^(UEN|TRN|CR|VAT|NO|NUMBER)[:-]*/i, "");
}

/** Guess the validator key from a free-text identifier type label. */
function keyFor(type: string, country?: string | null): string | null {
  const t = (type || "").toLowerCase();
  if (t.includes("uen") || (t.includes("acra") && t.includes("number"))) return "sg_uen";
  if (t.includes("trade licen") || t.includes("ded")) return "ae_trade_licence";
  if (t.includes("vat") && countryCode(country) === "SA") return "sa_vat";
  if (t.includes("vat") && countryCode(country) === "GB") return "gb_vat";
  if (t.includes("trn") || t.includes("tax registration")) return "ae_trn";
  if (t.includes("cr number") || t.includes("commercial registration")) return "sa_cr";
  if (t.includes("ssm") || t.includes("roc")) return "my_ssm";
  return null;
}

export function validateIdentifiers(
  raw: unknown,
  country?: string | null,
): ExtractedIdentifier[] {
  if (!Array.isArray(raw)) return [];
  const out: ExtractedIdentifier[] = [];
  for (const item of raw.slice(0, 8)) {
    const type = String((item as any)?.type ?? "").trim().slice(0, 60);
    const value = String((item as any)?.value ?? "").trim().slice(0, 60);
    if (!type && !value) continue;
    const key = keyFor(type, country);
    if (!key) {
      out.push({ type: type || "Identifier", value, valid: null, note: "No structural rule for this identifier type." });
      continue;
    }
    const v = VALIDATORS[key];
    const ok = v.test(normalise(value));
    out.push({
      type: v.label,
      value,
      valid: ok,
      note: ok ? "Format matches the national pattern." : `Suspicious format. ${v.hint}`,
    });
  }
  return out;
}
