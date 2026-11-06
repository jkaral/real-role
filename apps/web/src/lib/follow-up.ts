import type { TrackedApplication } from "@real-role/shared";

function text(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32 || character === "\t")
    .join("");
}
function fold(value: string): string {
  const encoder = new TextEncoder();
  let line = "",
    bytes = 0;
  const lines: string[] = [];
  for (const char of value) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {
      lines.push(line);
      line = " ";
      bytes = 1;
    }
    line += char;
    bytes += size;
  }
  lines.push(line);
  return lines.join("\r\n");
}
const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
export function followUpCalendar(app: TrackedApplication, now = new Date()): string {
  const date = app.followUpAt ? new Date(app.followUpAt) : null;
  if (!date || !Number.isFinite(date.getTime())) throw new Error("Set a follow-up date first.");
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Real Role//Follow-up//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${encodeURIComponent(app.id)}@real-role`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(date)}`,
      `DTEND:${stamp(new Date(date.getTime() + 1800000))}`,
      `SUMMARY:${text(`Follow up: ${app.title} at ${app.company}`)}`,
      `DESCRIPTION:${text(`Review your ${app.status} application and decide whether to follow up.\n${/^https?:\/\//.test(app.sourceUrl) ? app.sourceUrl : "Posting pasted as text."}`)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
export function followUpDraft(app: TrackedApplication, stage: "application" | "interview") {
  const subject = `Following up on ${app.title} at ${app.company}`;
  return `Subject: ${subject}\n\nHi [name],\n\n${stage === "interview" ? `Thank you for the conversation about the ${app.title} role. I appreciated learning more about [specific topic].` : `I’m following up on my application for the ${app.title} role at ${app.company}.`} I’m still interested and would welcome any update on the next steps or timeline.\n\nThank you for your time,\n[your name]`;
}
