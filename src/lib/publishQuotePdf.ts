/**
 * Publishes the branded quote PDF to private storage so client-facing emails
 * can carry a secure download link (the email system cannot carry binary
 * attachments). The stored path is recorded on the quote row; signed URLs are
 * minted at send time.
 */

import { supabase } from "@/integrations/supabase/client";
import { buildQuotePdf, type QuotePdfArgs } from "./quotePdf";

export const QUOTE_PDF_BUCKET = "quote-pdfs";

/** Signed link validity for client emails (90 days). */
export const QUOTE_PDF_LINK_TTL_SECONDS = 60 * 60 * 24 * 90;

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "quote";
}

/** Build the PDF, upload it, and stamp the path onto the quote. Returns the storage path. */
export async function publishQuotePdf(quoteId: string, args: QuotePdfArgs): Promise<string> {
  const doc = await buildQuotePdf(args);
  const blob = doc.output("blob") as Blob;
  // Every publication gets a unique object name. Reusing one path with upsert
  // allowed browser/CDN caches to keep serving an older quote after its PDF
  // had been corrected (most visibly, the pre-wrap totals layout).
  const version = new Date().toISOString().replace(/[^0-9]/g, "");
  const path = `${quoteId}/${safeName(args.quoteNumber)}-${version}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(QUOTE_PDF_BUCKET)
    .upload(path, blob, { contentType: "application/pdf", cacheControl: "0", upsert: false });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from("trade_quotes")
    .update({ client_pdf_path: path, client_pdf_updated_at: new Date().toISOString() } as never)
    .eq("id", quoteId);
  if (updateError) throw updateError;

  return path;
}

/** Mint a long-lived signed URL for a previously published quote PDF. */
export async function signedQuotePdfUrl(quoteId: string): Promise<string | null> {
  const { data: quote } = await supabase
    .from("trade_quotes")
    .select("client_pdf_path")
    .eq("id", quoteId)
    .maybeSingle();

  const path = (quote as { client_pdf_path?: string | null } | null)?.client_pdf_path;
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(QUOTE_PDF_BUCKET)
    .createSignedUrl(path, QUOTE_PDF_LINK_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}
