import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget: log a document download with the user's country.
 * @param documentId  – UUID from trade_documents (optional for spec sheets etc.)
 * @param label       – human-readable label when no document_id is available
 */
export function trackDownload(documentId?: string, label?: string) {
  supabase.auth.getUser().then(async ({ data }) => {
    if (!data?.user) return;
    let country = "";
    const { data: app } = await supabase
      .from("trade_applications")
      .select("country")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (app?.country) country = app.country;
    await supabase.from("document_downloads").insert({
      user_id: data.user.id,
      document_id: documentId ?? null,
      document_label: label ?? "",
      country,
    });
  }).catch(() => {});
}
