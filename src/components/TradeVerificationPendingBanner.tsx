import { Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

interface TradeVerificationPendingBannerProps {
  className?: string;
}

export function TradeVerificationPendingBanner({
  className,
}: TradeVerificationPendingBannerProps) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-xl items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <Hourglass
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <h6 className="text-sm font-semibold text-amber-800 sm:text-base">
          Trade Verification Pending
        </h6>
        <p className="mt-1 text-xs leading-relaxed text-amber-700 sm:text-sm">
          Your Google Trade channel credentials are currently under review. Access to checkout will be granted once your account is fully approved (usually within 24 hours).
        </p>
      </div>
    </div>
  );
}
