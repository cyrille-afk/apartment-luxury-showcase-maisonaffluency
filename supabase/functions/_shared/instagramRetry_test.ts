import { retryWhenInstagramWorks } from "./instagramRetry.ts";
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
Deno.test("broken Instagram connection never claims or checks studios", async () => {
  let claims = 0;
  const result = await retryWhenInstagramWorks("invalid_token", async () => { claims++; return [{ id: "studio" }]; }, async () => { throw new Error("Should not run"); });
  assert(claims === 0 && result.paused && result.attempted === 0, "Unavailable connection must pause without touching studios");
});
Deno.test("working connection automatically retries each claimed unverified studio", async () => {
  const checked: string[] = [];
  const result = await retryWhenInstagramWorks("working", async () => [{ id: "a" }, { id: "b" }], async (id) => { checked.push(id); });
  assert(result.attempted === 2 && checked.join() === "a,b", "All claimed studios must be retried");
});
Deno.test("failed check does not penalize studio or block remaining retries", async () => {
  const studios = [{ id: "a", score: null, status: "unverified" }, { id: "b", score: null, status: "unverified" }];
  const checked: string[] = [];
  await retryWhenInstagramWorks("working", async () => studios, async (id) => { checked.push(id); if (id === "a") throw new Error("Profile blocked"); });
  assert(studios[0].score === null && studios[0].status === "unverified", "Failed access must remain unverified without a score");
  assert(checked.join() === "a,b", "Failure must not block other studios");
});