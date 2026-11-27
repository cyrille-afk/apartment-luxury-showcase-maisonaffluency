import { isPermanentInstagramHandleError, retryWhenInstagramWorks, shouldRetryInstagramAccount } from "./instagramRetry.ts";
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
  assert(studios[0]?.score === null && studios[0]?.status === "unverified", "Failed access must remain unverified without a score");
  assert(checked.join() === "a,b", "Failure must not block other studios");
});

const eligible = { status: "pending", radar_status: "unverified", website_or_ig: "@studio", instagram_retry_blocked_source: null };
Deno.test("already-approved accounts never automatically retry", () => {
  assert(!shouldRetryInstagramAccount({ ...eligible, status: "approved" }), "Approved must be excluded even when unverified");
});
Deno.test("permanent handle failure blocks the submitted source", () => {
  assert(!shouldRetryInstagramAccount({ ...eligible, instagram_retry_blocked_source: "@studio" }), "Same failed handle must not retry");
});
Deno.test("a corrected Instagram handle can retry", () => {
  assert(shouldRetryInstagramAccount({ ...eligible, website_or_ig: "@corrected", instagram_retry_blocked_source: "@studio" }), "Corrected source must retry");
});
Deno.test("temporary connection outages preserve eligibility", () => {
  assert(shouldRetryInstagramAccount(eligible), "Temporary outages must not block eligible accounts");
  assert(!isPermanentInstagramHandleError("Instagram lookup error: connection timed out"), "Timeout must not be permanent");
});
Deno.test("explicit invalid user id and unavailable business handles are permanent", () => {
  assert(isPermanentInstagramHandleError("Instagram @gregarbonville: Invalid user id"), "Invalid handle must be permanent");
  assert(isPermanentInstagramHandleError("Instagram @studio: not found or not a business/creator account"), "Unavailable business handle must be permanent");
});
Deno.test("temporary API errors cannot be mistaken for a permanent handle error", () => {
  for (const detail of ["temporary lookup failure: Invalid user id", "HTTP 429: Invalid user id", "HTTP 503: Invalid user id", "Invalid OAuth token", "Rate limit exceeded"]) {
    assert(!isPermanentInstagramHandleError(detail), `${detail} must remain retryable`);
  }
});
Deno.test("non-Instagram and scored accounts never enter the retry queue", () => {
  assert(!shouldRetryInstagramAccount({ ...eligible, website_or_ig: "https://studio.com" }), "Website must not enter Instagram queue");
  assert(!shouldRetryInstagramAccount({ ...eligible, radar_status: "scored" }), "Scored account must not retry");
});
Deno.test("connection outage pauses and recovery resumes the same eligible work", async () => {
  let claims = 0;
  const checked: string[] = [];
  const claim = async () => { claims++; return [{ id: "studio" }]; };
  const analyze = async (id: string) => { checked.push(id); };
  await retryWhenInstagramWorks("error", claim, analyze);
  assert(claims === 0 && checked.length === 0, "Outage must not consume a claim");
  await retryWhenInstagramWorks("working", claim, analyze);
  assert(claims === 1 && checked.join() === "studio", "Recovery must resume verification");
});