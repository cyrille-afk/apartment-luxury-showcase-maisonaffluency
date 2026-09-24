import { useCallback, useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AccountRow {
  id: string;
  status: string;
  studio_name: string | null;
}

/**
 * Member dashboard status banner for the unified trade application
 * (`trade_accounts`). Approved accounts show nothing.
 */
export default function TradeVerificationTracker() {
  const { user } = useAuth();
  const [row, setRow] = useState<AccountRow | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("trade_accounts")
      .select("id, status, studio_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRow((data as AccountRow | null) ?? null);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!row || row.status === "approved") return null;
  const rejected = row.status === "rejected";

  return (
    <div className={`mb-6 rounded-lg border px-5 py-4 ${rejected ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/30"}`}>
      <div className="flex items-start gap-3">
        {rejected ? <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" /> : <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm text-foreground">{rejected ? "Application not approved" : "Application under review"}</p>
          <p className="font-body text-xs text-muted-foreground mt-1 leading-relaxed">
            {rejected ? (
              <>Please <Link to="/contact" className="underline underline-offset-2">contact us</Link> if you believe this is an error.</>
            ) : (
              `Our team is reviewing ${row.studio_name || "your studio"}. We typically confirm within 1–2 business days.`
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
