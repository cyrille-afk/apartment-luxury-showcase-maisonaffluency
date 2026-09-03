// Mock credential documents used by the verification test-suite.
//
// Each fixture mimics the OCR text a real Singapore / GCC / Rest-of-World
// credential produces, plus the identifiers a verification model would extract
// from it. They are test data only — never imported by the edge function.

export type MockDocument = {
  id: string;
  country: string;
  companyName: string;
  /** Plain-text OCR output of the credential document. */
  ocrText: string;
  /** Identifiers a well-behaved model extracts from the OCR text. */
  extractedIdentifiers: Array<{ type: string; value: string }>;
  /** Whether every identifier above is structurally valid. */
  expectAllValid: boolean;
};

export const MOCK_DOCUMENTS: MockDocument[] = [
  {
    id: "sg-acra-valid",
    country: "Singapore",
    companyName: "Tanglin Atelier Pte Ltd",
    ocrText: [
      "ACCOUNTING AND CORPORATE REGULATORY AUTHORITY (ACRA)",
      "BUSINESS PROFILE",
      "Entity Name: TANGLIN ATELIER PTE. LTD.",
      "Unique Entity Number (UEN): 201834567K",
      "Entity Type: Private Company Limited by Shares",
      "Principal Activity: Interior design services (SSIC 74100)",
      "Status: Live Company",
    ].join("\n"),
    extractedIdentifiers: [{ type: "Singapore UEN", value: "201834567K" }],
    expectAllValid: true,
  },
  {
    id: "sg-sidac-valid-alt-format",
    country: "SG",
    companyName: "Orchard Interiors LLP",
    ocrText: [
      "SINGAPORE INTERIOR DESIGN ACCREDITATION (SIDAC)",
      "Accredited Interior Designer — Class 2",
      "Firm: ORCHARD INTERIORS LLP",
      "UEN: T14LL0123B",
      "Valid through: 31 December 2027",
    ].join("\n"),
    extractedIdentifiers: [{ type: "Singapore UEN", value: "T14LL0123B" }],
    expectAllValid: true,
  },
  {
    id: "sg-uen-malformed",
    country: "Singapore",
    companyName: "Bukit Studio",
    ocrText: [
      "INVOICE — BUKIT STUDIO",
      "UEN: 12345 (as declared by applicant)",
      "Interior fit-out works",
    ].join("\n"),
    extractedIdentifiers: [{ type: "Singapore UEN", value: "12345" }],
    expectAllValid: false,
  },
  {
    id: "ae-ded-trn-valid",
    country: "United Arab Emirates",
    companyName: "Jumeirah Design House FZ-LLC",
    ocrText: [
      "GOVERNMENT OF DUBAI — DEPARTMENT OF ECONOMY AND TOURISM (DED)",
      "TRADE LICENCE",
      "Trade Name: JUMEIRAH DESIGN HOUSE FZ-LLC",
      "Licence No: CN-1234567",
      "Activity: Interior Design Consultancy",
      "Tax Registration Number (TRN): 100234567890003",
    ].join("\n"),
    extractedIdentifiers: [
      { type: "UAE Trade Licence", value: "CN-1234567" },
      { type: "UAE TRN", value: "100234567890003" },
    ],
    expectAllValid: true,
  },
  {
    id: "ae-trn-malformed",
    country: "AE",
    companyName: "Marina Interiors LLC",
    ocrText: [
      "DUBAI DED TRADE LICENCE",
      "Trade Name: MARINA INTERIORS LLC",
      "TRN: 1002345 (partially legible)",
    ].join("\n"),
    extractedIdentifiers: [{ type: "UAE TRN", value: "1002345" }],
    expectAllValid: false,
  },
  {
    id: "sa-cr-valid",
    country: "Saudi Arabia",
    companyName: "Riyadh Atelier Co.",
    ocrText: [
      "MINISTRY OF COMMERCE — KINGDOM OF SAUDI ARABIA",
      "COMMERCIAL REGISTRATION CERTIFICATE",
      "Name: RIYADH ATELIER CO.",
      "CR Number: 1010567890",
      "VAT Number: 310123456789003",
      "Activity: Architectural and interior design services",
    ].join("\n"),
    extractedIdentifiers: [
      { type: "Saudi CR Number", value: "1010567890" },
      { type: "VAT Number", value: "310123456789003" },
    ],
    expectAllValid: true,
  },
  {
    id: "sa-cr-malformed",
    country: "SA",
    companyName: "Jeddah Design Works",
    ocrText: [
      "COMMERCIAL REGISTRATION",
      "Name: JEDDAH DESIGN WORKS",
      "CR Number: 9010567890",
    ].join("\n"),
    extractedIdentifiers: [{ type: "Saudi CR Number", value: "9010567890" }],
    expectAllValid: false,
  },
  {
    id: "qa-gcc-trn-valid",
    country: "Qatar",
    companyName: "Doha Design Collective",
    ocrText: [
      "GENERAL TAX AUTHORITY — STATE OF QATAR",
      "Taxpayer: DOHA DESIGN COLLECTIVE",
      "Tax Registration Number: 512345678901234",
      "Commercial Registration attached",
    ].join("\n"),
    extractedIdentifiers: [{ type: "GCC TRN", value: "512345678901234" }],
    expectAllValid: true,
  },
  {
    id: "row-riba-no-identifier",
    country: "United Kingdom",
    companyName: "Fitzrovia Architects Ltd",
    ocrText: [
      "ROYAL INSTITUTE OF BRITISH ARCHITECTS",
      "Chartered Practice Certificate",
      "Practice: FITZROVIA ARCHITECTS LTD",
      "VAT Number: GB123456789",
    ].join("\n"),
    extractedIdentifiers: [{ type: "VAT Number", value: "GB123456789" }],
    expectAllValid: true,
  },
];
