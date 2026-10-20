import { parseMetaTokenInput } from "./metaTokenInput.ts";

function assert(ok: boolean) { if (!ok) throw new Error("Token input assertion failed"); }

Deno.test("opaque tokens with punctuation are passed unchanged to Meta", () => {
  const token = "test-only-opaque/token+with=punctuation";
  const result = parseMetaTokenInput(`  ${token}  `);
  assert(result.token === token && !result.error);
});
Deno.test("a URL is rejected without forwarding or returning the credential", () => {
  const result = parseMetaTokenInput("https://example.com/not-a-token");
  assert(result.token === "" && Boolean(result.error));
});
Deno.test("empty and non-string entries are recoverable validation failures", () => {
  for (const input of ["", "  ", null, 42]) assert(Boolean(parseMetaTokenInput(input).error));
});
Deno.test("headers and copied responses are not submitted as tokens", () => {
  for (const input of ["Bearer test-token", "token with spaces", '{"access_token":"test"}']) {
    assert(Boolean(parseMetaTokenInput(input).error));
  }
});