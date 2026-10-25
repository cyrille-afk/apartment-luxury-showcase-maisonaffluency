/** Reconcile loaded CSS on every route entry, not just the inline boot script. */
export function watchAppStylesheetReady(doc: Document): () => void {
  const link = doc.getElementById("app-css");
  if (!(link instanceof HTMLLinkElement)) return () => {};
  const reveal = () => {
    link.media = "all";
    doc.documentElement.classList.add("app-css");
    doc.documentElement.classList.remove("home-fouc");
  };
  if (link.sheet) reveal();
  else link.addEventListener("load", reveal);
  return () => link.removeEventListener("load", reveal);
}