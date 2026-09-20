// Real-time VAT / GST registration validation, shared by the public
// `validate-vat-number` endpoint and by the server-authoritative payment
// functions (which must never trust a client-supplied "verified" flag).
//
// Routing
//   GB…  → unified compliance aggregator (VAT_VALIDATION_API_KEY)
//   EU…  → aggregator when a key is present, otherwise the official EU VIES
//          SOAP endpoint (free, no credentials)
//   SG…  → structural UEN check (no public authority endpoint)
//
// Anything other than `{ valid: true }` means unverified: the tax engine then
// charges standard destination VAT. A timeout or outage never yields true.

const AGGREGATOR_URL = "https://api.apifreaks.com/v1.0/tax/vat/validate";
const VIES_URL = "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";
const TIMEOUT_MS = 8_000;

export const EU_VAT_PREFIXES = new Set([
  "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HR","HU","IE",
  "IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK",
]);

export type VatValidationResult = {
  valid: boolean;
  source: "aggregator" | "vies" | "structural" | "unavailable";
  name?: string | null;
  address?: string | null;
  reason?: string;
};

export const normaliseTaxId = (v: string) => v.replace(/[\s-]/g, "").trim().toUpperCase();

const withTimeout = async (fn: (signal: AbortSignal) => Promise<Response>) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
};

async function checkAggregator(taxId: string): Promise<VatValidationResult | null> {
  const key = Deno.env.get("VAT_VALIDATION_API_KEY");
  if (!key) return null;
  try {
    const res = await withTimeout((signal) =>
      fetch(`${AGGREGATOR_URL}?vatNumber=${encodeURIComponent(taxId)}`, {
        headers: { "X-apiKey": key, Accept: "application/json" },
        signal,
      })
    );
    if (!res.ok) return { valid: false, source: "unavailable", reason: `provider ${res.status}` };
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    const valid =
      data?.valid === true ||
      data?.isValid === true ||
      (data as any)?.data?.valid === true;
    return {
      valid: Boolean(valid),
      source: "aggregator",
      name: (data as any)?.name ?? (data as any)?.companyName ?? null,
      address: (data as any)?.address ?? null,
    };
  } catch (_e) {
    return { valid: false, source: "unavailable", reason: "provider timeout" };
  }
}

async function checkVies(taxId: string): Promise<VatValidationResult> {
  const cc = taxId.slice(0, 2) === "EL" ? "EL" : taxId.slice(0, 2);
  const number = taxId.slice(2);
  const envelope =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ` +
    `xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">` +
    `<soapenv:Body><urn:checkVat>` +
    `<urn:countryCode>${cc}</urn:countryCode><urn:vatNumber>${number}</urn:vatNumber>` +
    `</urn:checkVat></soapenv:Body></soapenv:Envelope>`;
  try {
    const res = await withTimeout((signal) =>
      fetch(VIES_URL, {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8" },
        body: envelope,
        signal,
      })
    );
    if (!res.ok) return { valid: false, source: "unavailable", reason: `vies ${res.status}` };
    const xml = await res.text();
    const valid = /<valid>\s*true\s*<\/valid>/i.test(xml);
    const name = xml.match(/<name>([\s\S]*?)<\/name>/i)?.[1]?.trim() ?? null;
    const address = xml.match(/<address>([\s\S]*?)<\/address>/i)?.[1]?.trim() ?? null;
    return { valid, source: "vies", name, address };
  } catch (_e) {
    return { valid: false, source: "unavailable", reason: "vies timeout" };
  }
}

const SG_UEN = /^(\d{9}[A-Z]|[TSPR]\d{2}[A-Z]{2}\d{4}[A-Z])$/;

/** Authoritative check. Never throws; failures resolve to `valid: false`. */
export async function verifyVatNumber(
  rawTaxId: string,
  rawCountry?: string | null,
): Promise<VatValidationResult & { taxId: string }> {
  const taxId = normaliseTaxId(rawTaxId || "");
  const country = (rawCountry || "").trim().toUpperCase();
  const prefix = taxId.slice(0, 2);
  if (taxId.length < 4) {
    return { taxId, valid: false, source: "unavailable", reason: "too short" };
  }

  // Singapore: no public authority endpoint — structural check only.
  if (country === "SG" && !EU_VAT_PREFIXES.has(prefix) && prefix !== "GB") {
    return { taxId, valid: SG_UEN.test(taxId), source: "structural" };
  }

  // UK: aggregator only. Without a key the number stays unverified so the
  // engine charges standard UK VAT rather than granting a reverse charge.
  if (prefix === "GB" || country === "GB") {
    const agg = await checkAggregator(taxId);
    return { taxId, ...(agg ?? { valid: false, source: "unavailable", reason: "no aggregator key" }) };
  }

  if (EU_VAT_PREFIXES.has(prefix === "EL" ? "GR" : prefix) || EU_VAT_PREFIXES.has(country)) {
    const agg = await checkAggregator(taxId);
    if (agg && agg.source === "aggregator") return { taxId, ...agg };
    return { taxId, ...(await checkVies(taxId)) };
  }

  return { taxId, valid: false, source: "unavailable", reason: "unsupported jurisdiction" };
}
