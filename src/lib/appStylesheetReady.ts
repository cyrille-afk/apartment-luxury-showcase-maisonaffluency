/** Reconcile loaded CSS on every route entry, not just the inline boot script. */
export function watchAppStylesheetReady(doc: Document): () => void {
  const link = doc.getElementById("app-css");
  if (!(link instanceof HTMLLinkElement)) return () => {};
  const reveal = () => {
    link.media = "all";
    doc.documentElement.classList.add("app-css");
    doc.documentElement.classList.remove("home-fouc");
    // The shell's hydration render can restore this fallback after Hero's
    // mount effect has hidden it. Never leave two copies of the headline.
    doc.getElementById("static-hero-copy")?.style.setProperty("display", "none");
  };
  if (link.sheet) reveal();
  else link.addEventListener("load", reveal);
  return () => link.removeEventListener("load", reveal);
}