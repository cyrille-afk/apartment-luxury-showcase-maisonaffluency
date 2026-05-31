// Conventions for structured AI output across this codebase.
//
// PREFER (in order of strictness):
//   1. OpenAI-style function/tool calling with a JSON-Schema `parameters` block
//      and `tool_choice: { type: "function", function: { name } }`.
//      → see parse-shipment-document, suggest-ffe-layout, trade-concierge sentiment.
//
//   2. `response_format: { type: "json_object" }` when the model is asked to
//      emit JSON but the shape is enforced server-side after parsing.
//      → see board-recommendations, compute-taste-profiles.
//
//   3. Free-text only when the output is meant for human display
//      (translate-text, product-description-writer).
//
// AVOID:
//   - "Return JSON" instructions without `response_format` or tool calling.
//     The model will sometimes add prose around it and break JSON.parse.
//   - Verbose "return ONLY valid JSON with the following keys…" prompt prefaces.
//     The schema + tool_choice already enforces this; the prose just burns tokens.

/** Helper to validate a parsed tool-call arguments object against required keys. */
export function requireKeys<T extends Record<string, unknown>>(
  obj: unknown,
  keys: ReadonlyArray<keyof T>,
): obj is T {
  if (!obj || typeof obj !== "object") return false;
  for (const k of keys) {
    if (!(k as string in obj)) return false;
  }
  return true;
}
