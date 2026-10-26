export interface DesignerEditorNavigation {
  search: string;
  activeLetter: string | null;
  expandedId: string | null;
}

/** A failed restore collapses heavy content without discarding the user's place. */
export function recoverDesignerEditorDraft<T extends DesignerEditorNavigation>(
  draft: Partial<T>,
  navigation: Partial<DesignerEditorNavigation>,
  collapse: boolean,
) {
  const merged = { ...draft, ...navigation };
  return { ...merged, expandedId: collapse ? null : merged.expandedId ?? null };
}