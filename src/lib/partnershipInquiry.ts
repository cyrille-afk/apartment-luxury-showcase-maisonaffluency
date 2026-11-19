import { z } from "zod";

/**
 * Shared validation for developer-partnership inquiries sent from the pitch
 * page. Browser-safe (no server imports) so the form and the public route use
 * exactly the same rules.
 */

/** Hidden trap field: bots fill it, people never see it. */
export const PARTNERSHIP_HONEYPOT_FIELD = "website_url";

/** Address shown on the pitch and used for the owner notification subject. */
export const PARTNERSHIP_INQUIRY_EMAIL = "concierge@maisonaffluency.com";

const partnershipInquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Please enter your name")
    .max(100, "Name must be 100 characters or fewer"),
  company: z
    .string()
    .trim()
    .max(120, "Company must be 120 characters or fewer")
    .default(""),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email must be 255 characters or fewer"),
  phone: z
    .string()
    .trim()
    .max(30, "Phone must be 30 characters or fewer")
    .default(""),
  project: z
    .string()
    .trim()
    .max(160, "Project must be 160 characters or fewer")
    .default(""),
  message: z
    .string()
    .trim()
    .min(10, "Please add a little more detail (at least 10 characters)")
    .max(2000, "Message must be 2000 characters or fewer"),
  website_url: z.string().max(500).optional(),
});

export type PartnershipInquiryValues = {
  name: string;
  company: string;
  email: string;
  phone: string;
  project: string;
  message: string;
};

export type PartnershipInquiryResult =
  | { ok: true; data: PartnershipInquiryValues }
  | { ok: false; spam: true; errors: Record<string, string> }
  | { ok: false; spam: false; errors: Record<string, string> };

export function validatePartnershipInquiry(
  payload: unknown,
): PartnershipInquiryResult {
  const parsed = partnershipInquirySchema.safeParse(payload);

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !errors[key]) errors[key] = issue.message;
    }
    return { ok: false, spam: false, errors };
  }

  // A filled trap field means an automated submission: report success to the
  // caller but store nothing.
  if (parsed.data.website_url && parsed.data.website_url.trim() !== "") {
    return { ok: false, spam: true, errors: {} };
  }

  const { website_url: _trap, ...data } = parsed.data;
  return { ok: true, data };
}
