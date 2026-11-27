import { instagramRetrievalFailure } from "./instagramRetrievalFailure.ts";

Deno.test("working connection with unavailable applicant is a profile failure, not a reconnect failure", () => {
  const result = instagramRetrievalFailure({ state: "working", message: "Connected" }, ["Instagram @gregarbonville: not found"]);
  if (result.kind !== "profile_unavailable") throw new Error("Working login must not be classified as unavailable");
});

Deno.test("working login plus invalid applicant handle stops automatic retries", () => {
  const result = instagramRetrievalFailure({ state: "working", message: "Connected" }, ["Instagram @gregarbonville: Invalid user id"]);
  if (!result.permanentHandleError) throw new Error("Invalid user id must be terminal when connection works");
});
Deno.test("connection outages do not permanently block applicant handles", () => {
  const result = instagramRetrievalFailure({ state: "error", message: "Connection timed out" }, ["Instagram @studio: Invalid user id"]);
  if (result.permanentHandleError) throw new Error("Outage must not become an applicant-handle block");
});
Deno.test("transient discovery errors stay retryable with a working login", () => {
  const result = instagramRetrievalFailure({ state: "working", message: "Connected" }, ["Instagram temporary lookup failure @studio: Invalid user id"]);
  if (result.permanentHandleError) throw new Error("Transient discovery failure must remain retryable");
});

Deno.test("invalid connection remains a connection failure", () => {
  const result = instagramRetrievalFailure({ state: "invalid_token", message: "Rejected" }, []);
  if (result.kind !== "connection_unavailable") throw new Error("Rejected login must be classified as unavailable");
});