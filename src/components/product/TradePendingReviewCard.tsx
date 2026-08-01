import { Clock } from "lucide-react";

/**
 * Shown in place of the trade pricing area for members whose studio
 * credentials are still being vetted (profiles.trade_status =
 * 'pending_review'). Deliberately renders no pricing and never mounts
 * Felix — the concierge bundle is not even requested for these sessions.
 */
export default function TradePendingReviewCard() {
  return (
    <div className="mt-4 rounded-lg border border-border/70 bg-muted/30 px-5 py-6 md:px-7 md:py-8">
      <div className="flex items-center gap-2.5">
        <Clock size={15} className="text-muted-foreground" strokeWidth={1.5} />
        <h3 className="font-body text-[11px] md:text-xs uppercase tracking-[0.18em] text-foreground">
          Application Received
        </h3>
      </div>
      <p className="font-body text-xs md:text-sm text-muted-foreground leading-relaxed mt-3">
        Our atelier team is manually reviewing your studio credentials. You will receive an email
        notice once your trade dashboard and Felix AI Co-Pilot are fully unlocked.
      </p>
    </div>
  );
}
