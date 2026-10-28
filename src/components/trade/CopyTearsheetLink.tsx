import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getClientSafeMode } from "@/lib/clientSafeMode";

/** Resolve a shared path to an absolute URL for sharing. */
export function copyTearsheetHref(path: string): string {
  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  const href = /^https?:\/\//i.test(path) ? path : `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  if (!getClientSafeMode() || !origin) return href;
  const url = new URL(href);
  if (url.origin === origin && /^\/trade\/(tearsheets|boards)(?:\/|$)/.test(url.pathname)) {
    url.searchParams.set("presentation", "1");
    return url.href;
  }
  return href;
}

interface Props {
  /** App path (e.g. /trade/tearsheets?project=…) or absolute URL to copy. */
  path: string;
  label?: string;
  /** "inline" sits beside links/pills; "block" is a full-width quiet row under a button. */
  variant?: "inline" | "block";
  className?: string;
}

export function CopyTearsheetLink({ path, label = "Copy link", variant = "inline", className }: Props) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const handleCopy = async () => {
    const url = copyTearsheetHref(path);
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (!ok) return;
    setCopied(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 2000);
  };

  if (variant === "block") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "w-full inline-flex items-center justify-center gap-1.5 mt-2 py-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors",
          className,
        )}
        aria-label={copied ? "Link copied" : `Copy link: ${label}`}
      >
        {copied ? <Check size={13} /> : <Link2 size={13} />}
        {copied ? "Link copied" : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Link copied" : `Copy link: ${label}`}
      aria-label={copied ? "Link copied" : `Copy link: ${label}`}
      className={cn(
        "inline-flex items-center gap-1 font-body text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors",
        className,
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export default CopyTearsheetLink;
