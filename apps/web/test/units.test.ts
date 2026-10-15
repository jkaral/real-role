import { describe, expect, it } from "vitest";
import { z } from "zod";
import { careersCandidates } from "../src/server/careers";
import { assertPublicUrl, isPrivateAddress } from "../src/server/fetch-page";
import { HttpError, corsHeaders, readBody } from "../src/server/http";
import { windowStart } from "../src/server/rate-limit";
import { postedAtFromText, postingFromText, titleFromText } from "../src/server/text-posting";

const NOW = new Date("2026-10-15T12:00:00.000Z");

describe("pasted text", () => {
  it("reads posted dates", () => {
    expect(postedAtFromText("Posted 3 days ago", NOW)).toBe("2026-10-12T12:00:00.000Z");
    expect(postedAtFromText("Reposted 2 weeks ago", NOW)).toBe("2026-10-01T12:00:00.000Z");
    expect(postedAtFromText("posted today", NOW)).toBe(NOW.toISOString());
    expect(postedAtFromText("Posted on 2026-09-01", NOW)).toBe("2026-09-01T00:00:00.000Z");
    expect(postedAtFromText("No date here", NOW)).toBeUndefined();
  });

  it("builds a posting with sensible defaults", () => {
    const p = postingFromText(
      { text: "Data Analyst\nMaintain revenue dashboards for the finance team." },
      NOW,
    );
    expect(p).toMatchObject({
      title: "Data Analyst",
      company: "Unknown employer",
      source: "pasted_text",
      sourceUrl: "about:pasted-text",
    });
  });

  it("finds the job title in running text", () => {
    expect(
      titleFromText(
        "Northwind Lumen seeks a Data Analyst for the Finance Analytics team. Maintain dashboards.",
      ),
    ).toBe("Data Analyst");
    expect(titleFromText("We're hiring: Senior Platform Engineer, remote in Canada.")).toBe(
      "Senior Platform Engineer",
    );
    expect(titleFromText("Bramblecrest is looking for our next Head of Design to lead…")).toBe(
      "Head of Design",
    );
    // No capitalised role and no short first line: leave it to the caller's fallback.
    expect(
      titleFromText("We are looking for a motivated self-starter to join our dynamic team today."),
    ).toBeUndefined();
  });
});

describe("URL safety", () => {
  it("flags private and special addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["93.184.216.34", "2606:4700::1111"])
      expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("says a host that doesn't resolve can't be found", async () => {
    await expect(assertPublicUrl("https://jobs.bramblecrest.invalid/1")).rejects.toMatchObject({
      code: "upstream_unavailable",
    });
  });

  it("rejects unsafe URLs without any network call", async () => {
    for (const url of [
      "ftp://jobs.example/1",
      "http://localhost/jobs",
      "http://127.0.0.1/jobs",
      "http://[::1]/jobs",
      "http://169.254.169.254/latest/meta-data",
      "https://user:pass@93.184.216.34/",
      "https://93.184.216.34:8443/",
      "not a url",
    ]) {
      await expect(assertPublicUrl(url), url).rejects.toBeInstanceOf(HttpError);
    }
    await expect(assertPublicUrl("https://93.184.216.34/jobs/1")).resolves.toBeInstanceOf(URL);
  });
});

describe("http helpers", () => {
  it("validates bodies with zod", async () => {
    const schema = z.object({ a: z.number() });
    const ok = new Request("http://x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    await expect(readBody(ok, schema)).resolves.toEqual({ a: 1 });
    const bad = new Request("http://x", { method: "POST", body: "{" });
    await expect(readBody(bad, schema)).rejects.toMatchObject({ code: "bad_request" });
    const wrong = new Request("http://x", { method: "POST", body: JSON.stringify({ a: "1" }) });
    await expect(readBody(wrong, schema)).rejects.toMatchObject({ code: "bad_request" });
  });

  it("only echoes allowed extension origins", () => {
    process.env.EXTENSION_ORIGINS = "chrome-extension://abc";
    const allowed = new Request("http://x", { headers: { origin: "chrome-extension://abc" } });
    const other = new Request("http://x", { headers: { origin: "https://evil.example" } });
    expect(corsHeaders(allowed)["Access-Control-Allow-Origin"]).toBe("chrome-extension://abc");
    expect(corsHeaders(other)).toEqual({});
  });

  it("aligns rate-limit windows", () => {
    expect(windowStart(125_500, 60)).toBe(120);
  });
});

describe("careers candidates", () => {
  it("uses hosted-board URLs and careers links only", () => {
    const base = {
      title: "Engineer",
      company: "Mapleglass Systems",
      descriptionText: "",
      parsedBy: "x",
    };
    expect(
      careersCandidates({ ...base, sourceUrl: "https://jobs.example/1", source: "generic" }),
    ).toEqual([]);
    expect(
      careersCandidates({
        ...base,
        sourceUrl: "https://jobs.lever.co/mapleglass/42",
        source: "lever",
        companyCareersUrl: "https://jobs.lever.co/mapleglass",
      }),
    ).toEqual(["https://jobs.lever.co/mapleglass", "https://jobs.lever.co/mapleglass/42"]);
  });
});
