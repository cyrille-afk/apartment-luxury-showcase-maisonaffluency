/**
 * Client-side slash-command registry for the Trade Concierge composer.
 *
 * These commands intercept the composer submit BEFORE any LLM call — the
 * concierge edge function is never contacted. That keeps the tearsheet-card
 * output contract intact and gives us deterministic, hallucination-free
 * behaviour for commands that just format existing database rows.
 */

export type ParsedSlashCommand =
  | { kind: "spec_schedule"; zone: string | null; boardHint: string | null }
  | { kind: "help" };

/**
 * Parse a raw composer input. Returns `null` when the text is not a
 * recognised slash command and should be forwarded to the concierge.
 *
 * Accepted shapes:
 *   /spec-schedule
 *   /spec-schedule Dining Room A
 *   /spec-schedule board:<id-or-title-fragment>
 *   /spec-schedule Dining Room A board:mayfair
 *   /help
 *
 * Anything after the command name that doesn't parse as `board:<x>` is
 * treated as the zone label. An unknown /command is NOT intercepted — we
 * return null so the concierge sees it verbatim.
 */
export function parseSlashCommand(raw: string): ParsedSlashCommand | null {
  const text = raw.trim();
  if (!text.startsWith("/")) return null;

  // First token = command name (case-insensitive).
  const firstSpace = text.search(/\s/);
  const cmd = (firstSpace === -1 ? text.slice(1) : text.slice(1, firstSpace)).toLowerCase();
  const rest = firstSpace === -1 ? "" : text.slice(firstSpace + 1).trim();

  if (cmd === "help") return { kind: "help" };

  if (cmd === "spec-schedule" || cmd === "spec_schedule" || cmd === "specsheet" || cmd === "schedule") {
    // Extract optional board:<hint> token; the remainder (if any) is the zone.
    let boardHint: string | null = null;
    let zone: string | null = null;

    const boardMatch = rest.match(/(^|\s)board:([^\s].*?)(?=\s+\S+:|$)/i);
    if (boardMatch) {
      boardHint = boardMatch[2].trim() || null;
    }
    const zonePart = boardMatch
      ? (rest.slice(0, boardMatch.index ?? 0) + rest.slice((boardMatch.index ?? 0) + boardMatch[0].length))
      : rest;
    const cleanedZone = zonePart.replace(/\s+/g, " ").trim();
    if (cleanedZone) zone = cleanedZone;

    return { kind: "spec_schedule", zone, boardHint };
  }

  return null;
}

export const SLASH_COMMAND_HELP = [
  "**Available commands**",
  "",
  "- `/spec-schedule` — export a markdown specification schedule for the pieces in your active tearsheet.",
  "- `/spec-schedule <Zone name>` — same, with a custom zone header (e.g. `Dining Room A`).",
  "- `/spec-schedule board:<title or id>` — target a specific tearsheet by title fragment or UUID prefix.",
  "- `/help` — show this list.",
  "",
  "_Anything else is sent to the Concierge as normal._",
].join("\n");
