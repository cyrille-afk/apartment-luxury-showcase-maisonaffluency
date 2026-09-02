/**
 * Official payment marks — Visa & Mastercard via simple-icons (react-icons/si),
 * bank/wire transfer via the Lucide `Landmark` glyph.
 * All monochrome currentColor, uniform h-5, transparent backgrounds.
 */
import { SiVisa, SiMastercard } from "react-icons/si";
import { Landmark } from "lucide-react";

export function VisaMark({ className = "" }: { className?: string }) {
  return <SiVisa aria-label="Visa" className={`h-5 w-auto shrink-0 ${className}`} />;
}

export function MastercardMark({ className = "" }: { className?: string }) {
  return <SiMastercard aria-label="Mastercard" className={`h-5 w-auto shrink-0 ${className}`} />;
}

export function BankTransferMark({ className = "" }: { className?: string }) {
  return (
    <Landmark
      aria-label="Bank transfer"
      strokeWidth={1.3}
      className={`h-5 w-5 shrink-0 ${className}`}
    />
  );
}
