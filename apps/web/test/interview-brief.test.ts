import { describe, expect, it } from "vitest";
import { buildInterviewBrief } from "../src/lib/interview-brief";
const posting = {
  title: "Platform Engineer",
  company: "Bramblecrest Analytics",
  sourceUrl: "about:pasted-text",
  source: "pasted_text" as const,
  parsedBy: "test",
  descriptionText:
    "Own deployment pipelines for the platform team. Maintain Kubernetes clusters and document incidents.",
};
describe("local posting-grounded preparation", () => {
  it("quotes disclosed responsibilities and leaves unknown metadata explicit", () => {
    const brief = buildInterviewBrief(posting);
    expect(brief).toContain("Own deployment pipelines");
    expect(brief).toContain("Disclosed location: Unknown");
    expect(brief).toContain("not verified company facts");
  });
  it("does not invent responsibilities when text is absent", () => {
    const brief = buildInterviewBrief({ ...posting, descriptionText: "" });
    expect(brief).toContain("did not provide a clear responsibility");
    expect(brief).not.toContain("Kubernetes");
  });
});
