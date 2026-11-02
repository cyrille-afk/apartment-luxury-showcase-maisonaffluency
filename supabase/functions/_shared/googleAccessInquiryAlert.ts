export const GOOGLE_ACCESS_TEMPLATE_SID = "HXa58e98945bf95f5cc14c0193d7bd4f6e";

/** Recognise only the fixed, validated contact-form request, not other inquiries. */
export function googleAccessInquiryAlert(input: {
  source?: string;
  subject?: string;
  message?: string;
  name: string;
  email: string;
}) {
  if (input.source !== "contact_form" ||
      input.subject !== "Google sign-in blocked — Trade access request" ||
      input.message !== "I was blocked when signing in with Google. Please review my request for Trade access using this email address. This request does not grant Google sign-in or Trade approval.") return null;
  const clean = (value: string) => value.replace(/\s+/g, " ").trim();
  const name = clean(input.name);
  const email = clean(input.email);
  return {
    event: "google_access_inquiry",
    contentVariables: { "1": name, "2": email },
    body: [
      "New Google-access inquiry on Maison Affluency.",
      `Name: ${name}. Google email: ${email}.`,
      "The visitor reports being blocked when signing in with Google.",
      "This is not a completed Trade application and does not grant Google sign-in or Trade approval.",
      "Review in the inquiries inbox: https://www.maisonaffluency.com/trade/admin/inquiries",
    ].join("\n"),
  };
}