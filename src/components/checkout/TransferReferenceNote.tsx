import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

/**
 * Mandatory wire-transfer reference call-out.
 * Rendered below the bank coordinates in every wire flow so banks and our
 * treasury team can match the incoming transfer instantly.
 */
export function TransferReferenceNote({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="w-full border border-neutral-200 bg-neutral-50 px-5 py-4">
      <div className="flex items-center justify-between gap-x-6 gap-y-1">
        <span className="flex-none text-[10px] font-light uppercase tracking-[0.22em] text-muted-foreground">
          Reference Note
        </span>
        <span className="flex min-w-0 items-center justify-end gap-3 text-right">
          <span className="truncate text-sm font-medium tabular-nums text-foreground">
            {value}
          </span>
          <button
            type="button"
            aria-label="Copy reference"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value);
                setCopied(true);
                toast.success("Reference copied");
                setTimeout(() => setCopied(false), 2000);
              } catch {
                toast.error("Unable to copy — please select the text manually.");
              }
            }}
            className={
              copied
                ? "flex-none border border-foreground p-1.5 text-foreground"
                : "flex-none border border-neutral-200 p-1.5 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            }
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        </span>
      </div>
      <p className="mt-3 border-t border-neutral-100 pt-3 text-xs font-light leading-relaxed text-muted-foreground">
        Please include this exact reference string in your bank transfer memo to
        guarantee instant approval and processing by our treasury team.
      </p>
    </div>
  );
}

export default TransferReferenceNote;
