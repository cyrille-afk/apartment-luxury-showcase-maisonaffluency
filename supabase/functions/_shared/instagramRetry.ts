export async function retryWhenInstagramWorks(
  state: string,
  claim: () => Promise<Array<{ id: string }>>,
  analyze: (id: string) => Promise<void>,
) {
  if (state !== "working") return { paused: true, attempted: 0 };
  const accounts = await claim();
  await Promise.all(accounts.map(async (account) => {
    // Individual failures never prevent another studio's verification.
    try { await analyze(account.id); } catch { /* existing evidence/score remains untouched */ }
  }));
  return { paused: false, attempted: accounts.length };
}