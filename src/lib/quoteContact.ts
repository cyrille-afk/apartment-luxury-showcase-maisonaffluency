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

export { displayNameForContact, suggestEmailName } from "../../supabase/functions/_shared/quoteContactDisplay";
