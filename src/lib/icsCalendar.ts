/**
 * Build an .ics (iCalendar) file for a single trade fair event.
 * Compatible with Apple Calendar, Google Calendar, Outlook.
 */
export type IcsEvent = {
  uid: string;
  title: string;
  starts_on: string; // YYYY-MM-DD
  ends_on: string;   // YYYY-MM-DD (inclusive)
  location?: string;
  description?: string;
  url?: string;
};

const formatDate = (iso: string) => iso.replace(/-/g, "");

const escapeText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

export function buildIcsFile(event: IcsEvent): string {
  // DTEND is exclusive in iCal — add 1 day to the inclusive ends_on.
  const end = new Date(event.ends_on + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 1);
  const dtend = end.toISOString().slice(0, 10).replace(/-/g, "");

  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Maison Affluency//Trade Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}@maisonaffluency.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${formatDate(event.starts_on)}`,
    `DTEND;VALUE=DATE:${dtend}`,
    `SUMMARY:${escapeText(event.title)}`,
    event.location ? `LOCATION:${escapeText(event.location)}` : null,
    event.description ? `DESCRIPTION:${escapeText(event.description)}` : null,
    event.url ? `URL:${event.url}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n");
}

export function downloadIcs(event: IcsEvent, filename?: string) {
  const blob = new Blob([buildIcsFile(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `${event.uid}.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}
