export type FilterableStudioPairing = {
  category: string;
  finishes: string[];
};

export function studioPairingFilterOptions(pairings: FilterableStudioPairing[]) {
  return {
    categories: [...new Set(pairings.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    finishes: [...new Set(pairings.flatMap(p => p.finishes))].sort((a, b) => a.localeCompare(b)),
  };
}

export function filterStudioPairings<T extends FilterableStudioPairing>(pairings: T[], category: string, finish: string): T[] {
  return pairings.filter(p => (!category || p.category === category) && (!finish || p.finishes.includes(finish)));
}