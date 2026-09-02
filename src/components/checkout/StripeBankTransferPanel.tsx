import { useEffect, useState } from "react";
import { Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Stripe virtual bank transfer — localized routing per currency.      */
/* Stripe issues a virtual account in the rail native to the checkout  */
/* currency (SEPA IBAN for EUR, sort code for GBP, ACH/wire for USD…). */
/* ------------------------------------------------------------------ */

export type WireItem = {
  title: string;
  designer?: string;
  selectedFinish?: string;
  price: number; // major units
  quantity: number;
};

type FinancialAddress = {
  type: string;
  iban?: { bic?: string; iban?: string; country?: string; account_holder_name?: string };
  sort_code?: { sort_code?: string; account_number?: string; account_holder_name?: string };
  aba?: {
    account_number?: string;
    routing_number?: string;
    bank_name?: string;
    account_holder_name?: string;
  };
  swift?: { account_number?: string; bank_name?: string; swift_code?: string };
  spei?: { clabe?: string; bank_name?: string; bank_code?: string };
  zengin?: Record<string, string | undefined>;
  supported_networks?: string[];
};

type Row = { label: string; value: string; copyable?: boolean };

const RAIL_LABEL: Record<string, string> = {
  iban: "SEPA transfer · IBAN",
  sort_code: "UK Faster Payments · Sort code",
  aba: "US domestic ACH / Wire",
  swift: "International SWIFT",
  spei: "SPEI · Mexico",
  zengin: "Zengin · Japan",
};

function addressRows(a: FinancialAddress): Row[] {
  switch (a.type) {
    case "iban":
      return [
        { label: "Account Holder", value: a.iban?.account_holder_name || "" },
        { label: "IBAN", value: a.iban?.iban || "", copyable: true },
        { label: "BIC / SWIFT", value: a.iban?.bic || "", copyable: true },
        { label: "Country", value: a.iban?.country || "" },
      ];
    case "sort_code":
      return [
        { label: "Account Holder", value: a.sort_code?.account_holder_name || "" },
        { label: "Sort Code", value: a.sort_code?.sort_code || "", copyable: true },
        { label: "Account Number", value: a.sort_code?.account_number || "", copyable: true },
      ];
    case "aba":
      return [
        { label: "Account Holder", value: a.aba?.account_holder_name || "" },
        { label: "Bank Name", value: a.aba?.bank_name || "" },
        { label: "Routing Number", value: a.aba?.routing_number || "", copyable: true },
        { label: "Account Number", value: a.aba?.account_number || "", copyable: true },
      ];
    case "swift":
      return [
        { label: "Bank Name", value: a.swift?.bank_name || "" },
        { label: "SWIFT / BIC Code", value: a.swift?.swift_code || "", copyable: true },
        { label: "Account Number", value: a.swift?.account_number || "", copyable: true },
      ];
    case "spei":
      return [
        { label: "Bank Name", value: a.spei?.bank_name || "" },
        { label: "CLABE", value: a.spei?.clabe || "", copyable: true },
        { label: "Bank Code", value: a.spei?.bank_code || "" },
      ];
    case "zengin":
      return Object.entries(a.zengin || {}).map(([k, v]) => ({
        label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: String(v ?? ""),
        copyable: /account_number|bank_code|branch_code/.test(k),
      }));
    default:
      return [];
  }
}

export function CopyValueButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copied`);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Unable to copy — please select the text manually.");
        }
      }}
      className={cn(
        "flex-none rounded-none border p-1.5 transition-colors",
        copied
          ? "border-foreground text-foreground"
          : "border-neutral-200 text-muted-foreground hover:border-foreground hover:text-foreground",
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function RowGrid({ rows, reference }: { rows: Row[]; reference?: string | null }) {
  const all = reference
    ? [...rows, { label: "Payment Reference", value: reference, copyable: true }]
    : rows;
  return (
    <div className="w-full border border-neutral-200">
      {all
        .filter((r) => r.value)
        .map((row, i) => (
          <div
            key={row.label}
            className={cn(
              "flex items-center justify-between gap-x-6 px-5 py-4",
              i > 0 && "border-t border-neutral-100",
            )}
          >
            <span className="flex-none text-[10px] font-light uppercase tracking-[0.22em] text-muted-foreground">
              {row.label}
            </span>
            <span className="flex min-w-0 items-center justify-end gap-3 text-right">
              <span className="truncate text-sm font-light tabular-nums">{row.value}</span>
              {row.copyable && <CopyValueButton value={row.value} label={row.label} />}
            </span>
          </div>
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Failure diagnostics — why virtual routing could not be issued.      */
/* ------------------------------------------------------------------ */
type FailureReason = "not_enabled" | "unsupported_currency" | "error" | null;

function classifyFailure(code?: string, detail?: string, transport?: string): FailureReason {
  if (code === "unsupported_currency") return "unsupported_currency";
  const text = `${detail ?? ""} ${transport ?? ""}`.toLowerCase();
  if (
    code === "bank_transfer_unavailable" &&
    (text.includes("customer_balance") ||
      text.includes("activated in your dashboard") ||
      text.includes("payment method type") ||
      text === " ")
  ) {
    return "not_enabled";
  }
  if (code === "bank_transfer_unavailable") return "not_enabled";
  return "error";
}

function isOperatorView() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

function UnavailableBanner({ reason, currency }: { reason: FailureReason; currency: string }) {
  if (!reason) return null;

  const buyerCopy =
    reason === "unsupported_currency"
      ? `Automatic ${currency.toUpperCase()} routing isn’t available for this currency. Use the verified account details below, or your advisor will confirm the best route for your bank.`
      : reason === "not_enabled"
        ? "Automatically generated local routing is momentarily unavailable. The verified Maison Affluency account details below remain valid for this order."
        : "We couldn’t generate your dedicated account just now. The verified account details below remain valid — our concierge will confirm receipt.";

  return (
    <div className="border border-neutral-200 bg-neutral-50 px-5 py-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none text-muted-foreground" />
        <div className="space-y-2">
          <p className="text-[10px] font-light uppercase tracking-[0.22em] text-muted-foreground">
            {reason === "unsupported_currency"
              ? `Local ${currency.toUpperCase()} routing unavailable`
              : "Virtual routing unavailable"}
          </p>
          <p className="text-xs font-light leading-relaxed text-muted-foreground">{buyerCopy}</p>

          {isOperatorView() && reason === "not_enabled" && (
            <div className="mt-3 border-t border-neutral-200 pt-3 text-[11px] font-light leading-relaxed text-muted-foreground">
              <span className="uppercase tracking-[0.2em]">Operator note</span>
              <p className="mt-1">
                Stripe rejected <code>customer_balance</code>: bank transfers are not
                activated on the connected account. Enable them in Stripe →{" "}
                <strong>Settings → Payments → Payment methods → Bank transfers</strong>{" "}
                (approval required), then reload this tab. Virtual IBAN / sort code /
                ACH routing will populate automatically.
              </p>
              <a
                href="https://dashboard.stripe.com/settings/payment_methods"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block underline underline-offset-4"
              >
                Open Stripe payment methods
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StripeBankTransferPanel({
  items,
  currency,
  email,
  shippingConfirmed,
  shippingCents,
  orderReference,
  fallback,
}: {
  items: WireItem[];
  currency: string;
  email: string;
  shippingConfirmed?: boolean;
  shippingCents?: number;
  orderReference?: string;
  fallback: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState<FailureReason>(null);
  const [addresses, setAddresses] = useState<FinancialAddress[]>([]);
  const [reference, setReference] = useState<string | null>(null);
  const [hostedUrl, setHostedUrl] = useState<string | null>(null);
  const [activeRail, setActiveRail] = useState(0);

  const hasEmail = email.includes("@");
  const key = JSON.stringify({ currency, email: hasEmail ? email : "", n: items.length, shippingCents });

  useEffect(() => {
    if (!hasEmail || !items.length) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setReason(null);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("create-bank-transfer-intent", {
          body: {
            email,
            currency,
            items,
            shippingConfirmed: !!shippingConfirmed,
            shippingCents: shippingCents ?? 0,
          },
        });
        if (cancelled) return;
        const list = (data as any)?.financialAddresses as FinancialAddress[] | undefined;
        if (error || (data as any)?.error || !list?.length) {
          setFailed(true);
          setReason(
            classifyFailure(
              (data as any)?.error,
              (data as any)?.detail,
              error ? String((error as any)?.message ?? "") : "",
            ),
          );
        } else {
          setAddresses(list);
          setActiveRail(0);
          setReference((data as any)?.reference ?? null);
          setHostedUrl((data as any)?.hostedInstructionsUrl ?? null);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
          setReason("error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!hasEmail) {
    return (
      <div className="border border-neutral-200 px-5 py-6">
        <p className="text-xs font-light text-muted-foreground">
          Add your email address above and your dedicated{" "}
          {currency.toUpperCase()} account details will appear here instantly.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 border border-neutral-200 px-5 py-8 text-xs font-light text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Generating your dedicated {currency.toUpperCase()} account…
      </div>
    );
  }

  if (failed || !addresses.length) {
    return (
      <div className="space-y-5">
        <UnavailableBanner reason={reason} currency={currency} />
        {fallback}
      </div>
    );
  }


  const rail = addresses[Math.min(activeRail, addresses.length - 1)];

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-light uppercase tracking-[0.26em] text-muted-foreground">
        Dedicated {currency.toUpperCase()} account · issued for this order
      </p>

      {addresses.length > 1 && (
        <div className="grid w-full grid-cols-1 border border-neutral-200 sm:grid-cols-2">
          {addresses.map((a, i) => (
            <button
              key={a.type}
              type="button"
              onClick={() => setActiveRail(i)}
              className={cn(
                "px-5 py-3 text-[10px] font-light uppercase tracking-[0.22em] transition-colors",
                i > 0 && "border-t border-neutral-200 sm:border-l sm:border-t-0",
                i === activeRail
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {RAIL_LABEL[a.type] || a.type}
            </button>
          ))}
        </div>
      )}

      <RowGrid rows={addressRows(rail)} reference={reference} />

      {orderReference && <TransferReferenceNote value={orderReference} />}

      <p className="text-xs font-light text-muted-foreground">
        Transfers must include the reference note above so your order is matched
        automatically. Our concierge will also email these fully-insured wiring
        instructions within one business hour.
      </p>

      {hostedUrl && (
        <a
          href={hostedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-[10px] font-light uppercase tracking-[0.24em] underline underline-offset-4"
        >
          View secure Stripe instructions
        </a>
      )}
    </div>
  );
}
