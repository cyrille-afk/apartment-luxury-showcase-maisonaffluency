export const ADMIN_EMAILS = ["concierge@maisonaffluency.com", "cyrille@maisonaffluency.com", "gregoire@maisonaffluency.com"];
export function pendingRecipients(recipients: string[], done: Record<string, unknown>): string[] {
  return [...new Set(recipients)].filter((recipient) => !done[recipient]);
}
export const CUSTOMER_ACCOUNT_TEMPLATE_SID = "HX360382e2838845956c4b82e94b31d829";
export function isPublicAccountAlert(type: string, source: string, metadata: Record<string, unknown>) {
  return type === "new_account" && source === "profiles" && metadata.registration_origin === "public_account";
}
export function alertCopy(row: Record<string, unknown>) {
  const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 250);
  const email = clean(row.email);
  const name = clean(row.contact_name) || clean([row.first_name, row.last_name].filter(Boolean).join(" ")) || email;
  const studio = clean(row.studio_name || row.company_name || row.company) || "Not provided";
  const phone = clean(row.phone_number || row.phone) || "Not provided";
  const title = "New customer account created";
  return { email, name, studio, phone, title, text: `${title} on Maison Affluency.\nName: ${name}\nEmail: ${email}\nThe customer registered to save favorites and folders. This is not a Trade application; no Trade approval is required.` };
}