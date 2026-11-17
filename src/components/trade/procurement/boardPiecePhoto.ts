// This catalogue entry contains gallery photos of several different Ibo shapes.
// Its finish-only map cannot identify the selected shape or size.
const IBO_LOW_TABLE_PRODUCT_ID = "fd8c2682-d8a1-48fe-b110-d22209cbcce7";

export function boardPiecePhoto(
  productId: string,
  cataloguePhoto: string | null | undefined,
  finishPhoto: string | null | undefined,
): string | null {
  if (productId === IBO_LOW_TABLE_PRODUCT_ID) return cataloguePhoto || null;
  return finishPhoto || cataloguePhoto || null;
}