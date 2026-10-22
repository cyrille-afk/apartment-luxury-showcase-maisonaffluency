import type { CatalogManifest, CatalogManifestDesigner } from "./catalogManifest";

const normalizeMaker = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Missing maker rows are not public permission or a Maison attribution. */
export function publicGalleryDesigners(manifest: CatalogManifest | undefined): CatalogManifestDesigner[] {
  return (manifest?.designers ?? []).filter((designer) => designer.is_published && !designer.trade_only);
}

export function publicGalleryPicks(manifest: CatalogManifest | undefined) {
  const publicIds = new Set(publicGalleryDesigners(manifest).map((designer) => designer.id));
  return (manifest?.picks ?? []).filter((pick) => publicIds.has(pick.designer_id));
}

export function isPublicGalleryMaker(name: string, manifest: CatalogManifest | undefined): boolean {
  const key = normalizeMaker(name);
  return !!key && publicGalleryDesigners(manifest).some((designer) =>
    [designer.name, designer.display_name, designer.slug].some((label) => label && normalizeMaker(label) === key),
  );
}