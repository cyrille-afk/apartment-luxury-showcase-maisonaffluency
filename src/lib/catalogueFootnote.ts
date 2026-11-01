/** Only confirmed public guests see the catalogue footnote, never signed-in accounts. */
export function shouldShowCatalogueFootnote(hasUser: boolean, authLoading: boolean): boolean {
  return !hasUser && !authLoading;
}