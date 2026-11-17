export type ViewingRoomPackageDraft = {
  moodboard_id: string;
  tier_name: string;
  package_price: string;
  currency: string;
  description: string;
  lead_time_weeks?: string;
};

export function viewingRoomPackageError(rows: ViewingRoomPackageDraft[], boardIds: string[]): string | null {
  if (rows.length < 3 || rows.length > 5) return "Assign between 3 and 5 packages.";
  if (rows.some(row => !boardIds.includes(row.moodboard_id))) return "Choose a mood board from this project for every package.";
  if (new Set(rows.map(row => row.moodboard_id)).size !== rows.length) return "Each package needs a different mood board.";
  if (rows.some(row => !row.tier_name.trim())) return "Name every package tier.";
  if (new Set(rows.map(row => row.tier_name.trim())).size !== rows.length) return "Tier names must be unique within this layout.";
  if (rows.some(row => !row.package_price.trim() || !Number.isFinite(Number(row.package_price)) || Number(row.package_price) < 0)) return "Enter a non-negative package price for every tier.";
  if (rows.some(row => !["EUR", "USD", "SGD", "GBP", "CHF"].includes(row.currency))) return "Choose a supported currency.";
  return null;
}