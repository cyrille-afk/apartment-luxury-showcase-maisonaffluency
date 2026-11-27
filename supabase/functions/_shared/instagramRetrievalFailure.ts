import type { InstagramCheck } from "./metaToken.ts";
import { isPermanentInstagramHandleError } from "./instagramRetry.ts";

export function instagramRetrievalFailure(check: InstagramCheck, notes: string[]) {
  const kind = check.state === "working" ? "profile_unavailable" : "connection_unavailable";
  const detail = notes.filter((note) => note.startsWith("Instagram ") || note.startsWith("Meta ")).join("; ").slice(0, 500);
  const permanentHandleError = check.state === "working" && isPermanentInstagramHandleError(detail);
  const message = kind === "profile_unavailable"
    ? `Instagram connection is working, but this applicant's portfolio could not be retrieved.${detail ? ` ${detail}.` : ""} The studio remains unverified and is not marked down.`
    : `Instagram connection check failed: ${check.message} The studio remains unverified and is not marked down.`;
  return { kind, message, permanentHandleError };
}