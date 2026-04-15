type DesignerHierarchyCandidate = {
  name?: string | null;
  display_name?: string | null;
  founder?: string | null;
};

export const isParentBrandDesigner = (designer: DesignerHierarchyCandidate | null | undefined) => {
  if (!designer?.founder) return false;
  const identityNames = [designer.name, designer.display_name].filter(
    (value): value is string => Boolean(value?.trim())
  );
  return identityNames.includes(designer.founder);
};

export const isChildBrandDesigner = (designer: DesignerHierarchyCandidate | null | undefined) => {
  if (!designer?.founder) return false;
  return !isParentBrandDesigner(designer);
};