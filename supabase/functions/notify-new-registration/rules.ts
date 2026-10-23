export const ADMIN_EMAILS = ["concierge@maisonaffluency.com", "cyrille@maisonaffluency.com", "gregoire@maisonaffluency.com"];
export function pendingRecipients(recipients: string[], done: Record<string, unknown>): string[] {
  return [...new Set(recipients)].filter((recipient) => !done[recipient]);
}
export function alertCopy(type: string, row: Record<string, unknown>) {
  const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 250);
  const email = clean(row.email);
  const name = clean(row.contact_name) || clean([row.first_name, row.last_name].filter(Boolean).join(" ")) || email;
  const studio = clean(row.studio_name || row.company_name || row.company) || "Not provided";
  const phone = clean(row.phone_number || row.phone) || "Not provided";
  const title = type === "new_account" ? "New account registration" : "New Trade application";
  return { email, name, studio, phone, title, text: `${title}\nName: ${name}\nEmail: ${email}\nStudio: ${studio}\nPhone: ${phone}\nReview: https://www.maisonaffluency.com/trade/admin/trade-applications` };
}