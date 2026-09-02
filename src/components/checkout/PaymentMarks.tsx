/**
 * Monochrome payment marks — Visa, Mastercard and a minimalist bank/wire glyph.
 * Rendered in currentColor so they inherit the surrounding text token.
 */

const base = "h-5 w-auto shrink-0";

export function VisaMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 16"
      role="img"
      aria-label="Visa"
      fill="currentColor"
      className={`${base} ${className}`}
    >
      <path d="M18.9 15.4h-3.9L17.4.6h3.9l-2.4 14.8Z" />
      <path d="M33.1.9A9.6 9.6 0 0 0 29.6.3c-3.9 0-6.6 2-6.6 4.9 0 2.1 2 3.3 3.5 4 1.5.7 2 1.2 2 1.9 0 1-1.2 1.5-2.4 1.5-1.6 0-2.5-.2-3.8-.8l-.5-.2-.6 3.4c.9.4 2.6.8 4.4.8 4.1 0 6.8-2 6.8-5.1 0-1.7-1-3-3.3-4.1-1.4-.7-2.2-1.1-2.2-1.8 0-.6.7-1.3 2.3-1.3 1.3 0 2.3.3 3 .6l.4.2.6-3.3Z" />
      <path d="M38.4.6c-.9 0-1.6.3-2 1.2L30.6 15.4h4.1l.8-2.2h5l.5 2.2H44.7L41.6.6h-3.2Zm-1.7 9.6 1.5-4.1c0 .1.3-.8.5-1.4l.3 1.2.9 4.3h-3.2Z" />
      <path d="M11.6.6 7.8 10.7l-.4-2.1C6.7 6.2 4.5 3.6 2 2.3l3.5 13.1h4.2L15.8.6h-4.2Z" />
      <path d="M4.3.6H0v.3c3.3.8 5.6 2.9 6.5 5.4L5.1 1.8c-.2-.9-.8-1.2-1.6-1.2Z" />
    </svg>
  );
}

export function MastercardMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 24"
      role="img"
      aria-label="Mastercard"
      className={`${base} ${className}`}
    >
      <circle cx="15" cy="12" r="11" fill="currentColor" fillOpacity="0.9" />
      <circle
        cx="25"
        cy="12"
        r="11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function BankTransferMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Bank transfer"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="square"
      className={`${base} ${className}`}
    >
      <path d="M2.5 8.5 12 3.5l9.5 5" />
      <path d="M5 10.5v7M9.5 10.5v7M14.5 10.5v7M19 10.5v7" />
      <path d="M2.5 20.5h19" />
    </svg>
  );
}
