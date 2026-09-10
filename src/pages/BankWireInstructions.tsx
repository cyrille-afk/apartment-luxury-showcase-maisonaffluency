import { useMemo, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Check } from "lucide-react";
import { jsPDF } from "jspdf";
import Navigation from "@/components/Navigation";
import { copyTextToClipboard } from "@/lib/clipboard";
import { DEFAULT_BANK_WIRE_CONFIG, buildPaymentReference } from "@/config/bankWire";
import { formatMoney } from "@/lib/cart";

interface CopyableRowProps {
  label: string;
  value: string;
}

function CopyableRow({ label, value }: CopyableRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(value);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400 font-medium">
          {label}
        </div>
        <div className="mt-1 break-all font-body text-sm text-zinc-900">
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
        className="mt-4 flex-none text-[10px] uppercase tracking-widest text-zinc-400 hover:text-black font-semibold transition-colors underline underline-offset-4"
      >
        {copied ? (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <Check className="h-3 w-3" />
            Copied
          </span>
        ) : (
          "Copy"
        )}
      </button>
    </div>
  );
}

export default function BankWireInstructions() {
  const [params] = useSearchParams();
  const [downloading, setDownloading] = useState(false);

  const orderRef = params.get("ref") || "";
  const amountParam = params.get("amount");
  const currency = params.get("currency") || "USD";
  const amountCents = amountParam ? Number(amountParam) : 0;

  const paymentReference = useMemo(
    () => buildPaymentReference(orderRef),
    [orderRef]
  );

  const displayTotal = useMemo(() => {
    if (!amountCents || amountCents <= 0) return `${currency} —`;
    return formatMoney(amountCents, currency);
  }, [amountCents, currency]);

  const config = DEFAULT_BANK_WIRE_CONFIG;

  const handleDownloadPdf = useCallback(() => {
    setDownloading(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageW = doc.internal.pageSize.getWidth();
      const M = 54;
      const right = pageW - M;
      let y = M;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("MAISON AFFLUENCY", right, y, { align: "right" });
      y += 14;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(24, 24, 24);
      doc.text("Pro-forma Invoice / Wire Instructions", M, y);
      y += 28;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Order Reference: ${orderRef || "—"}`, M, y);
      doc.text(`Total Due: ${displayTotal}`, right, y, { align: "right" });
      y += 18;

      doc.setDrawColor(214, 212, 206);
      doc.setLineWidth(0.5);
      doc.line(M, y, pageW - M, y);
      y += 22;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(24, 24, 24);
      doc.text("Bank Wire Details", M, y);
      y += 18;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const details = [
        ["Beneficiary Name", config.beneficiaryName],
        ["Beneficiary Bank", config.beneficiaryBank],
        ["Bank Address", config.beneficiaryBankAddress || ""],
        ["SWIFT / BIC Code", config.swiftBic],
        ["Intermediary BIC", config.intermediaryBic || ""],
        ["Account Number", config.accountNumber || ""],
        ["IBAN Account", config.iban || ""],
        ["Payment Reference", paymentReference],
      ];

      for (const [label, value] of details) {
        if (!value) continue;
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(8);
        doc.text(label, M, y);
        y += 12;
        doc.setTextColor(24, 24, 24);
        doc.setFontSize(10);
        doc.text(value, M, y);
        y += 22;
      }

      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const note =
        "Your pieces are reserved. Inventory allocations remain securely held for 5 business days " +
        "pending remittance clearance. Please initiate the wire transfer using the exact details above " +
        "and quote the payment reference so our treasury team can match your deposit instantly.";
      const split = doc.splitTextToSize(note, pageW - 2 * M);
      doc.text(split, M, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `${config.beneficiaryName} · maisonaffluency.com · hello@maisonaffluency.com`,
        pageW / 2,
        doc.internal.pageSize.getHeight() - 18,
        { align: "center" }
      );

      doc.save(`maison-affluency-proforma-${orderRef || "instructions"}.pdf`);
    } finally {
      setDownloading(false);
    }
  }, [orderRef, displayTotal, paymentReference, config]);

  const pageTitle = orderRef
    ? `Bank Wire Instructions — Order ${orderRef}`
    : "Bank Wire Instructions — Maison Affluency";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <Navigation borderless />

      <main className="mx-auto max-w-2xl px-6 py-12 font-sans text-zinc-900 antialiased">
        <div className="text-center">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-sm border border-emerald-100 bg-emerald-50/60 px-3 py-1.5 text-xs font-medium uppercase tracking-widest text-emerald-800">
            <Check className="h-3 w-3" />
            Order Commission Reserved
          </span>
        </div>

        <h1 className="text-center font-display text-[1.6rem] font-normal tracking-[-0.01em] md:text-[2rem]">
          Bank Wire Settlement Instructions
        </h1>

        <div className="mt-6 border-b border-zinc-100 pb-4 text-sm">
          <div className="flex items-center justify-between gap-4 py-2">
            <span className="text-zinc-500">Order Reference</span>
            <span className="font-medium tabular-nums">
              {orderRef || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <span className="text-zinc-500">Total Due</span>
            <span className="font-medium tabular-nums">{displayTotal}</span>
          </div>
        </div>

        <p className="mt-4 text-xs font-light leading-relaxed text-zinc-500">
          Your pieces are reserved. Inventory allocations remain securely held for
          5 business days pending remittance clearance. Please initiate the wire
          transfer using the exact details below and quote the payment reference
          so our treasury team can match your deposit instantly.
        </p>

        <div className="mt-8 rounded-lg border border-zinc-200/80 bg-white p-5 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400 font-medium">
                  Beneficiary Name
                </div>
                <div className="mt-1 font-body text-sm text-zinc-900">
                  {config.beneficiaryName}
                </div>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400 font-medium">
                  Beneficiary Bank
                </div>
                <div className="mt-1 font-body text-sm text-zinc-900">
                  {config.beneficiaryBank}
                </div>
                {config.beneficiaryBankAddress && (
                  <div className="mt-0.5 text-[11px] text-zinc-400">
                    {config.beneficiaryBankAddress}
                  </div>
                )}
              </div>
            </div>

            <CopyableRow label="Swift / BIC Code" value={config.swiftBic} />
            {config.intermediaryBic && (
              <CopyableRow label="Intermediary BIC" value={config.intermediaryBic} />
            )}
            {config.accountNumber && (
              <CopyableRow label="Account Number" value={config.accountNumber} />
            )}
            {config.iban && (
              <CopyableRow label="IBAN Account" value={config.iban} />
            )}
            <CopyableRow label="Payment Reference" value={paymentReference} />
          </div>
          {config.transferNote && (
            <p className="mt-4 border-t border-zinc-100 pt-4 text-[11px] font-light leading-relaxed text-zinc-500">
              {config.transferNote}
            </p>
          )}
        </div>

        <div className="mt-10 space-y-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="w-full bg-black py-4 px-6 text-center text-xs font-semibold uppercase tracking-widest text-white shadow-xs transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            {downloading ? "Generating PDF…" : "Download PDF Proforma Invoice"}
          </button>
          <Link
            to="/designers"
            className="inline-block w-full border border-zinc-300 bg-white py-4 px-6 text-center text-xs font-semibold uppercase tracking-widest text-zinc-700 transition-colors hover:border-zinc-400 hover:text-black"
          >
            Return to Catalog
          </Link>
        </div>

        <p className="mt-8 text-center text-[10px] font-light leading-relaxed text-zinc-400">
          Questions? Email us at{" "}
          <a
            href="mailto:hello@maisonaffluency.com"
            className="underline underline-offset-4 hover:text-zinc-600"
          >
            hello@maisonaffluency.com
          </a>
          {" "}or WhatsApp{" "}
          <a
            href="https://wa.me/6591393850"
            className="underline underline-offset-4 hover:text-zinc-600"
          >
            +65 9139 3850
          </a>
          .
        </p>
      </main>
    </div>
  );
}
