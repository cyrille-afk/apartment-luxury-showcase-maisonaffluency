import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget: log a document download with the user's country.
 * Uses getSession (local/cached) instead of getUser (network) so the
 * insert fires before `<a target="_blank">` navigates the page away.
 *
 * @param documentId  – UUID from trade_documents (optional for spec sheets etc.)
 * @param label       – human-readable label when no document_id is available
 */
export function trackDownload(documentId?: string, label?: string) {
  (async () => {
    try {
      // getSession is synchronous/cached – won't be cancelled by navigation
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const userId = session.user.id;

      // Look up country from trade_applications
      let country = "";
      try {
        const { data: app } = await supabase
          .from("trade_applications")
          .select("country")
          .eq("user_id", userId)
          .maybeSingle();
        if (app?.country) country = app.country;
      } catch {
        // If trade_applications lookup fails, continue without country
      }

      const { error } = await supabase.from("document_downloads").insert({
        user_id: userId,
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
