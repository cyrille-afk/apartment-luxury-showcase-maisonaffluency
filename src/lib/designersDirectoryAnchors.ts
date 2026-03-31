export type DesignersDirectoryLayout = "mobile" | "desktop";

const MOBILE_BREAKPOINT = 768;

function isVisible(element: HTMLElement | null) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

export function getDesignersDirectoryLayout(): DesignersDirectoryLayout {
  if (typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT) {
    return "mobile";
  }

  const desktopRoot = document.querySelector<HTMLElement>('[data-directory-layout="desktop"]');
  if (isVisible(desktopRoot)) return "desktop";

  const mobileRoot = document.querySelector<HTMLElement>('[data-directory-layout="mobile"]');
  if (isVisible(mobileRoot)) return "mobile";

  return "desktop";
}

export function getDesignersDirectoryAnchorId(
  letter: string,
  layout: DesignersDirectoryLayout = getDesignersDirectoryLayout(),
) {
  return `${layout}-alpha-${letter.toUpperCase()}`;
}

export function getDesignersDirectoryAnchor(
  letter: string,
  layout: DesignersDirectoryLayout = getDesignersDirectoryLayout(),
) {
  return document.getElementById(getDesignersDirectoryAnchorId(letter, layout)) as HTMLElement | null;
}