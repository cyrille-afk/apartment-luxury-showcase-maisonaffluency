interface Contact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

/** Explicit quote details win; linked inquiries supply missing contact data. */
export function resolveQuoteContact(quote: Contact, inquiry?: Contact | null) {
  return {
    name: quote.name?.trim() || inquiry?.name?.trim() || "",
    email: quote.email?.trim() || inquiry?.email?.trim() || "",
    phone: quote.phone?.trim() || inquiry?.phone?.trim() || "",
  };
}

/** Display-only suggestion; never a verified or saved identity. */
export function suggestEmailName(email: string | null | undefined): string | null {
  const local = email?.split("@")[0] ?? "";
  if (!/^[a-z]+[._-][a-z]+$/i.test(local)) return null;
  return local.split(/[._-]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
}
