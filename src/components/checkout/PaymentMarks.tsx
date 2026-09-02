/**
 * Official payment marks — Visa via simple-icons (solid wordmark),
 * Mastercard as a custom SOLID two-circle mark (interlock lens knocked out)
 * so its visual weight balances the Visa wordmark, and bank/wire transfer
 * via the Lucide `Landmark` glyph.
 * All monochrome currentColor, uniform h-7, transparent backgrounds.
 */
import { SiVisa } from "react-icons/si";
import { Landmark } from "lucide-react";

export function VisaMark({ className = "" }: { className?: string }) {
  return <SiVisa aria-label="Visa" className={`h-7 w-auto shrink-0 ${className}`} />;
}

export function MastercardMark({ className = "" }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Mastercard"
      viewBox="0 0 40 24"
      fill="currentColor"
      fillRule="evenodd"
      className={`h-7 w-auto shrink-0 ${className}`}
    >
      <path d="M12 12 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 M28 12 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 M20 6 A10 10 0 0 1 20 18 A10 10 0 0 1 20 6 Z" />
    </svg>
  );
}

export function BankTransferMark({ className = "" }: { className?: string }) {
  return (
    <Landmark
      aria-label="Bank transfer"
      strokeWidth={1.3}
      className={`h-7 w-7 shrink-0 ${className}`}
    />
  );
}
