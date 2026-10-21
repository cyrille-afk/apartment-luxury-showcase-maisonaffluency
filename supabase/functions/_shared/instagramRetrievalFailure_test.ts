import { instagramRetrievalFailure } from "./instagramRetrievalFailure.ts";

Deno.test("working connection with unavailable applicant is a profile failure, not a reconnect failure", () => {
  const result = instagramRetrievalFailure({ state: "working", message: "Connected" }, ["Instagram @gregarbonville: not found"]);
  if (result.kind !== "profile_unavailable") throw new Error("Working login must not be classified as unavailable");
});

Deno.test("invalid connection remains a connection failure", () => {
  const result = instagramRetrievalFailure({ state: "invalid_token", message: "Rejected" }, []);
  if (result.kind !== "connection_unavailable") throw new Error("Rejected login must be classified as unavailable");
});