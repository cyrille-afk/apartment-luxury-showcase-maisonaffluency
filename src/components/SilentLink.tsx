import { forwardRef, useRef, MouseEvent, AnchorHTMLAttributes } from "react";
import { useNavigate } from "react-router-dom";

interface SilentLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  state?: unknown;
  replace?: boolean;
}

/**
 * Anchor that navigates via react-router but hides its destination from the
 * browser's status bar on hover. The anchor carries NO href at all (an href
 * of "#" still renders "site.com/path#" in the status bar), so Chrome/Safari/
 * Firefox never show a URL preview in the bottom-left. Right-click "Copy link" still works because
 * the real href is present on contextmenu.
 */
const SilentLink = forwardRef<HTMLAnchorElement, SilentLinkProps>(
  ({ to, state, replace, onClick, onMouseEnter, onMouseLeave, onContextMenu, children, ...rest }, ref) => {
    const navigate = useNavigate();
    const realHref = useRef(to);
    realHref.current = to;

    return (
      <a
        {...rest}
        ref={ref}
        role="link"
        tabIndex={0}
        onMouseEnter={(e) => {
          e.currentTarget.removeAttribute("href");
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.removeAttribute("href");
          onMouseLeave?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(realHref.current, { state: state as any, replace });
          }
        }}
        onContextMenu={(e) => {
          // Temporarily restore real href so "Copy link address" gives the true URL.
          e.currentTarget.setAttribute("href", realHref.current);
          onContextMenu?.(e);
          // Clear again on next tick so status bar doesn't flash.
          const el = e.currentTarget;
          window.setTimeout(() => el.removeAttribute("href"), 0);
        }}
        onClick={(e: MouseEvent<HTMLAnchorElement>) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          // Allow modifier clicks / middle-click to open in new tab with real URL.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
            e.currentTarget.setAttribute("href", realHref.current);
            return;
          }
          e.preventDefault();
          navigate(realHref.current, { state: state as any, replace });
        }}
      >
        {children}
      </a>
    );
  }
);
SilentLink.displayName = "SilentLink";

export default SilentLink;
