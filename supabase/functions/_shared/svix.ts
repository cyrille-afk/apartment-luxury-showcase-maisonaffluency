// Standard Webhooks / Svix signature verification (Resend uses this scheme).
//
// Signed content is `${svix-id}.${svix-timestamp}.${rawBody}`, HMAC-SHA256 with
// the base64 secret that follows the `whsec_` prefix. The header may carry
// several space-separated `v1,<base64sig>` values during secret rotation.

const TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type SvixHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export function readSvixHeaders(req: Request): SvixHeaders {
  const h = req.headers;
  return {
    id: h.get("svix-id") ?? h.get("webhook-id"),
    timestamp: h.get("svix-timestamp") ?? h.get("webhook-timestamp"),
    signature: h.get("svix-signature") ?? h.get("webhook-signature"),
  };
}

export async function verifySvixSignature(args: {
  secret: string;
  rawBody: string;
  headers: SvixHeaders;
  now?: number;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { secret, rawBody, headers } = args;
  if (!secret) return { ok: false, reason: "missing_secret" };
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing_headers" };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad_timestamp" };
  const nowSec = Math.floor((args.now ?? Date.now()) / 1000);
  if (Math.abs(nowSec - ts) > TOLERANCE_SECONDS) return { ok: false, reason: "timestamp_out_of_tolerance" };

  const secretBody = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(secretBody);
  } catch {
    keyBytes = new TextEncoder().encode(secretBody);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`),
  );
  const expected = bytesToBase64(signed);

  const provided = signature
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.includes(",") ? part.slice(part.indexOf(",") + 1) : part));

  for (const candidate of provided) {
    if (timingSafeEqual(candidate, expected)) return { ok: true };
  }
  return { ok: false, reason: "signature_mismatch" };
}

/** Test/helper counterpart: produce a valid `svix-signature` header value. */
export async function signSvixPayload(args: {
  secret: string;
  id: string;
  timestamp: string;
  rawBody: string;
}): Promise<string> {
  const secretBody = args.secret.startsWith("whsec_")
    ? args.secret.slice("whsec_".length)
    : args.secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(secretBody);
  } catch {
    keyBytes = new TextEncoder().encode(secretBody);
  }
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${args.id}.${args.timestamp}.${args.rawBody}`),
  );
  return `v1,${bytesToBase64(signed)}`;
}
