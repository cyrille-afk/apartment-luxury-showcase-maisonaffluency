export interface RecommendationRecord {
  id: string;
  source: 'curator' | 'trade';
  source_pick_id?: string | null;
  title?: string | null;
  brand?: string | null;
  category?: string | null;
  image_url?: string | null;
  is_hidden?: boolean | null;
  is_active?: boolean | null;
}

/** A supplier PDF/image is not evidence that an independently named Trade row is real. */
export function isValidatedRecommendation(
  record: RecommendationRecord,
  canonicalPickIds: ReadonlySet<string>,
): boolean {
  if (record.is_hidden !== false || !record.title?.trim() || !record.brand?.trim()
    || !record.category?.trim() || !record.image_url?.trim()) return false;
  if (record.source === 'curator') return canonicalPickIds.has(record.id);
  return record.is_active === true && Boolean(record.source_pick_id
    && canonicalPickIds.has(record.source_pick_id));
}