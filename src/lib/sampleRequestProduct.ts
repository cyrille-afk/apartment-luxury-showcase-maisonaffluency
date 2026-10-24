const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sample foreign keys reference Trade products, not curator picks or static IDs. */
export async function resolveSampleProductId(
  input: string | null,
  lookup: (id: string) => Promise<string | null>,
): Promise<string | null> {
  if (!input || !UUID.test(input)) return null;
  return lookup(input);
}