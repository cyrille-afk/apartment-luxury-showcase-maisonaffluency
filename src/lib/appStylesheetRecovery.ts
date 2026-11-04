/** Self-contained so the same guard can run before hydration in the document head. */
export function installAppStylesheetRecovery(doc: Document, backupHref: string): void {
  const primary = doc.getElementById("app-css") as (HTMLLinkElement & { recoveryInstalled?: boolean }) | null;
  if (!primary || primary.recoveryInstalled) return;
  primary.recoveryInstalled = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let backup: HTMLLinkElement | null = null;
  let settled = false;
  const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); };
  const reveal = () => {
    doc.documentElement.classList.add("app-css");
    doc.documentElement.classList.remove("home-fouc");
    doc.getElementById("static-hero-copy")?.style.setProperty("display", "none");
  };
  const primaryLoaded = () => {
    settled = true;
    clearTimer();
    primary.media = "all";
    backup?.remove();
    backup = null;
    doc.documentElement.removeAttribute("data-stylesheet-recovery");
    reveal();
  };
  const recover = () => {
    if (settled || backup) return;
    clearTimer();
    doc.documentElement.setAttribute("data-stylesheet-recovery", "loading");
    backup = doc.createElement("link");
    backup.id = "app-css-recovery";
    backup.rel = "stylesheet";
    backup.href = backupHref;
    backup.addEventListener("load", () => {
      if (settled || !backup) return;
      clearTimer();
      doc.documentElement.setAttribute("data-stylesheet-recovery", "loaded");
      reveal();
    }, { once: true });
    const failed = () => {
      if (settled) return;
      clearTimer();
      doc.documentElement.setAttribute("data-stylesheet-recovery", "failed");
    };
    backup.addEventListener("error", failed, { once: true });
    timer = setTimeout(failed, 8000);
    doc.head.append(backup);
  };
  primary.addEventListener("load", primaryLoaded);
  primary.addEventListener("error", recover);
  // Errors may have happened before this script was reached; bound that wait too.
  if (primary.sheet) primaryLoaded();
  else timer = setTimeout(recover, 8000);
}

export function appStylesheetRecoveryScript(backupHref: string): string {
  const safeHref = JSON.stringify(backupHref).replace(/</g, "\\u003c");
  return `(${installAppStylesheetRecovery.toString()})(document,${safeHref});`;
}