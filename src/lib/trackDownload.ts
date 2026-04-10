import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget: log a document download with the user's country.
 * Works for both document_id (trade_documents table) and standalone tracking.
 */
export function trackDownload(documentId: string) {
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
      document_id: documentId,
      country,
    });
  }).catch(() => {});
}
