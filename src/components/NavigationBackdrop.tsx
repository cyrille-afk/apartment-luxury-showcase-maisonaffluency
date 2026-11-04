import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function NavigationBackdrop({ onDismiss }: { onDismiss: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      data-navigation-backdrop
      aria-hidden="true"
      onClick={onDismiss}
      className="navigation-backdrop fixed inset-0 pointer-events-auto backdrop-blur-md"
    />,
    document.body,
  );
}