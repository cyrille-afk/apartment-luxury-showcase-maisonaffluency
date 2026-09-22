import { AlertCircle, Mail, MessageSquare, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OutboundMetricsCardProps {
  emailsSent?: number;
  dmsCopied?: number;
  emailResponseRate?: string | number;
  dmResponseRate?: string | number;
  isLoading?: boolean;
  isError?: boolean;
}

const formatRate = (rate?: string | number): string => {
  if (rate === undefined || rate === null) return "0%";
  if (typeof rate === "number") return `${Math.round(rate)}%`;
  const cleaned = String(rate).replace(/\s|%/g, "");
  const num = Number(cleaned);
  if (Number.isNaN(num)) return String(rate);
  return `${num}%`;
};

const MetricBadge = ({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Mail;
  value: number;
  label: string;
}) => (
  <div className="flex flex-col items-center rounded border border-slate-100 bg-slate-50 p-2.5 text-center">
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      <span className={cn(
        "font-bold text-slate-800 tabular-nums tracking-tight",
        value >= 1000000 ? "text-base" : value >= 10000 ? "text-lg" : "text-xl"
      )}>
        {value.toLocaleString()}
      </span>
    </div>
    <span className="mt-1 block text-[10px] text-slate-500 tracking-wide truncate max-w-full select-none">{label}</span>
  </div>
);

const LoadingMetricBadge = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center rounded border border-slate-100 bg-slate-50 p-2.5 text-center">
    <div className="h-7 w-16 animate-pulse rounded bg-slate-200" aria-hidden="true" />
    <span className="mt-2 h-3.5 w-20 animate-pulse rounded bg-slate-200" aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </div>
);

const OutboundMetricsCard = ({
  emailsSent = 1,
  dmsCopied = 0,
  emailResponseRate = "100%",
  dmResponseRate = "0%",
  isLoading = false,
  isError = false,
}: OutboundMetricsCardProps) => {
  const emailRate = formatRate(emailResponseRate);
  const dmRate = formatRate(dmResponseRate);
  const emailRateNum = Number(emailRate.replace("%", ""));
  const isHighEmailRate = !Number.isNaN(emailRateNum) && emailRateNum >= 80;

  return (
    <div
      className={cn(
        "rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase select-none">
          Outbound Acquisition
        </h3>
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            isError ? "bg-rose-600" : "bg-emerald-700"
          )}
          aria-hidden="true"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <LoadingMetricBadge label="Emails Sent loading" />
          <LoadingMetricBadge label="DMs Copied loading" />
        </div>
      ) : isError ? (
        <div className="grid grid-cols-2 gap-3 mb-3 opacity-40">
          <MetricBadge icon={Mail} value={emailsSent} label="Emails Sent" />
          <MetricBadge icon={dmsCopied > 0 ? MessageSquare : Copy} value={dmsCopied} label="DMs Copied" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <MetricBadge icon={Mail} value={emailsSent} label="Emails Sent" />
          <MetricBadge icon={dmsCopied > 0 ? MessageSquare : Copy} value={dmsCopied} label="DMs Copied" />
        </div>
      )}

      {isError && (
        <div className="mb-3 flex items-center justify-center gap-1 rounded border border-rose-100 bg-rose-50 p-1.5 text-[10px] text-rose-700">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate select-none">Sync pipeline paused</span>
        </div>
      )}

      <div className={cn(
        "border-t border-slate-100 pt-3 mt-1 flex items-center justify-between text-[10px] text-slate-600",
        isLoading && "opacity-60"
      )}>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-slate-500 truncate select-none tracking-wide">Email Response</span>
          {isLoading ? (
            <div className="h-4 w-10 animate-pulse rounded bg-slate-200" aria-hidden="true" />
          ) : (
            <span
              className={cn(
                "font-semibold truncate select-none",
                isHighEmailRate ? "text-emerald-600" : "text-slate-800"
              )}
            >
              {emailRate}
            </span>
          )}
        </div>

        <div className="w-[1px] h-4 bg-slate-200 mx-2 shrink-0" aria-hidden="true" />

        <div className="flex flex-col gap-0.5 text-right min-w-0">
          <span className="text-slate-500 truncate select-none tracking-wide">DM Resp. Rate</span>
          {isLoading ? (
            <div className="h-4 w-10 animate-pulse rounded bg-slate-200" aria-hidden="true" />
          ) : (
            <span className="font-semibold text-slate-800 truncate select-none">{dmRate}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutboundMetricsCard;
