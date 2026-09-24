type DesignerHierarchyCandidate = {
  name?: string | null;
  display_name?: string | null;
  founder?: string | null;
  is_independent?: boolean | null;
};

export const isParentBrandDesigner = (designer: DesignerHierarchyCandidate | null | undefined) => {
  if (!designer?.founder) return false;
  const identityNames = [designer.name, designer.display_name].filter(
    (value): value is string => Boolean(value?.trim())
  );
  return identityNames.includes(designer.founder);
};

export const isChildBrandDesigner = (designer: DesignerHierarchyCandidate | null | undefined) => {
  if (!designer?.founder || designer.is_independent === true) return false;
  return !isParentBrandDesigner(designer);
};