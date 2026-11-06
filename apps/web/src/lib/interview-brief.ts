import type { ParsedPosting } from "@real-role/shared";

/** Local preparation prompts grounded in posting excerpts; no model call or storage. */
export function buildInterviewBrief(posting: ParsedPosting): string {
  const excerpts = [
    ...new Set(
      posting.descriptionText
        .slice(0, 50000)
        .split(/\n+|(?<=[.!?])\s+/)
        .map((s) => s.trim().replace(/^[-•*]\s*/, ""))
        .filter(
          (s) =>
            s.length >= 25 &&
            /\b(own|build|develop|maintain|analy[sz]e|manage|design|support|lead|implement|deliver|operate|collaborate)\b/i.test(
              s,
            ),
        ),
    ),
  ]
    .slice(0, 3)
    .map((s) => s.slice(0, 240));
  const questions = excerpts.length
    ? excerpts.map(
        (excerpt, index) =>
          `${index + 1}. Posting excerpt: “${excerpt}”\n   Prepare one truthful example of related work: situation, your action, result, and what you learned. Ask how this responsibility is measured in this role.`,
      )
    : [
        "The posting did not provide a clear responsibility excerpt. Ask the interviewer what the role owns and how success is measured.",
      ];
  return [
    `Interview preparation: ${posting.title} at ${posting.company}`,
    "",
    `Disclosed location: ${posting.location ?? "Unknown"}`,
    `Employment type: ${posting.employmentType ?? "Unknown"}`,
    `Workplace: ${posting.remote === undefined ? "Unknown" : posting.remote ? "Remote" : "Not fully remote"}`,
    "",
    "ROLE-GROUNDED PRACTICE",
    ...questions,
    "",
    "QUESTIONS TO ASK",
    "- What would success in the first 90 days look like?",
    "- Which responsibilities are immediate priorities?",
    "- What are the remaining interview stages and expected timeline?",
    "- Is the role currently open, and are the location and pay details still current?",
    "",
    "PREPARATION CHECKLIST",
    "- Review the original posting and confirm details that are missing or unclear.",
    "- Choose accurate examples from your own experience; do not invent achievements.",
    "- Prepare questions about the team, expectations and working arrangement.",
    "- Confirm interview time, format, accessibility needs and contact details.",
    "",
    "Generated locally from the posting you checked. Excerpts may be shortened. These are preparation prompts, not verified company facts or predictions of interview questions. No description or personal background is stored by this tool.",
  ].join("\n");
}
