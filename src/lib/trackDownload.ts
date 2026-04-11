import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget: log a document download with the user's country.
 * @param documentId  – UUID from trade_documents (optional for spec sheets etc.)
 * @param label       – human-readable label when no document_id is available
 */
export function trackDownload(documentId?: string, label?: string) {
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Look up country from trade_applications
      let country = "";
      try {
        const { data: app } = await supabase
          .from("trade_applications")
          .select("country")
          .eq("user_id", user.id)
          .maybeSingle();
        if (app?.country) country = app.country;
      } catch {
        // If trade_applications lookup fails, continue without country
      }

      const { error } = await supabase.from("document_downloads").insert({
        user_id: user.id,
        document_id: documentId ?? null,
        document_label: label ?? "",
        country,
      });

      if (error) {
        console.error("[trackDownload] insert failed:", error.message);
      }
    } catch (err) {
      console.error("[trackDownload] unexpected error:", err);
    }
  })();
}
