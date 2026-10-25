/** A workflow continuation must not be reparsed as a fresh tearsheet brief. */
export function isLayoutScheduleContinuation(text: string, gateComplete: boolean): boolean {
  return gateComplete && /\[Layout selected\b|SELECTED LAYOUT:\s*Option\s+\d/i.test(text)
    && /propose_ffe_rows/.test(text);
}