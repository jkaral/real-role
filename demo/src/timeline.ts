export const segments = [
  { start: 0, end: 4, text: "Real Role. See the signals behind a job posting before you apply." },
  {
    start: 4,
    end: 20,
    text: "This fictional role is recent and specific. Real Role shows a freshness score on the page, with each signal explained in the panel. A score is evidence to consider, not a promise of an interview.",
  },
  {
    start: 20,
    end: 36,
    text: "This role has been seen repeatedly over sixty days. Its lower freshness reflects the age and observation history. You can inspect the reasons and decide whether it deserves your time.",
  },
  {
    start: 36,
    end: 52,
    text: "This description offers less detail. Real Role shows the available signals and lowers confidence when information is missing. An unknown careers provider does not count against the posting.",
  },
  {
    start: 52,
    end: 64,
    text: "Save a role to track your application. Your dashboard keeps the roles you choose and helps you remember when to follow up.",
  },
  {
    start: 64,
    end: 72,
    text: "Real Role. Make your next application an informed choice. Explore the live app at the address on screen.",
  },
] as const;
export function srt(): string {
  const time = (seconds: number) =>
    `00:${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")},000`;
  return segments
    .map((item, index) => `${index + 1}\n${time(item.start)} --> ${time(item.end)}\n${item.text}\n`)
    .join("\n");
}
