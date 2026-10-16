import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  findEmployerSource,
  identifyBoard,
  readOfficialBoard,
  EmployerSourceResponseSchema,
} from "../src";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const posting = {
  title: "Platform Engineer",
  company: "Bramblecrest Analytics",
  location: "Toronto",
  source: "lever" as const,
  sourceUrl: "https://jobs.lever.co/bramblecrest/42",
  externalId: "42",
  parsedBy: "test",
  descriptionText: "" as const,
};
const job = {
  id: "42",
  text: posting.title,
  hostedUrl: posting.sourceUrl,
  categories: { location: "Toronto" },
};
const endpoint = "https://api.lever.co/v0/postings/bramblecrest";

describe("employer source", () => {
  it("fetches once and identifies the exact listing without description text", async () => {
    let calls = 0;
    server.use(
      http.get(endpoint, () => {
        calls++;
        return HttpResponse.json([job]);
      }),
    );
    const result = await findEmployerSource({ posting });
    expect(calls).toBe(1);
    expect(result).toMatchObject({
      status: "matched",
      listing: { exactListing: true, url: posting.sourceUrl },
    });
    expect(EmployerSourceResponseSchema.safeParse(result).success).toBe(true);
    expect(result.checkedAt).toMatch(/Z$/);
  });

  it("asks for a board for aggregator and pasted postings without fetching", async () => {
    expect(
      (
        await findEmployerSource({
          posting: {
            ...posting,
            source: "generic",
            sourceUrl: "https://bramblecrest.example/jobs/42",
          },
        })
      ).status,
    ).toBe("needs_board");
  });

  it.each([
    "https://bramblecrest.example/careers",
    "http://jobs.lever.co/bramblecrest",
    "https://jobs.lever.co.evil.example/bramblecrest",
    "https://user:pass@jobs.lever.co/bramblecrest",
    "https://jobs.lever.co:8443/bramblecrest",
  ])("does not fetch an unsupported destination %s", async (boardUrl) => {
    expect((await findEmployerSource({ posting, boardUrl })).status).toBe("unsupported");
  });

  it("distinguishes a healthy empty board from an outage", async () => {
    server.use(http.get(endpoint, () => HttpResponse.json([])));
    expect(await readOfficialBoard(posting.sourceUrl)).toMatchObject({
      status: "available",
      roles: [],
    });
    expect((await findEmployerSource({ posting })).status).toBe("no_match");
    server.use(http.get(endpoint, () => new HttpResponse(null, { status: 503 })));
    expect((await findEmployerSource({ posting })).status).toBe("unavailable");
  });

  it("treats invalid provider data as unavailable rather than a missing listing", async () => {
    server.use(http.get(endpoint, () => HttpResponse.json({ unexpected: true })));
    expect((await findEmployerSource({ posting })).status).toBe("unavailable");
  });

  it("does not use matching IDs from a different employer board", async () => {
    server.use(
      http.get("https://api.lever.co/v0/postings/northwind", () =>
        HttpResponse.json([{ ...job, text: "Finance Director" }]),
      ),
    );
    expect(
      (await findEmployerSource({ posting, boardUrl: "https://jobs.lever.co/northwind" })).status,
    ).toBe("no_match");
  });

  it("does not use matching IDs across Lever regions", async () => {
    server.use(
      http.get("https://api.eu.lever.co/v0/postings/bramblecrest", () =>
        HttpResponse.json([{ ...job, text: "Finance Director" }]),
      ),
    );
    expect(
      (await findEmployerSource({ posting, boardUrl: "https://jobs.eu.lever.co/bramblecrest" }))
        .status,
    ).toBe("no_match");
  });

  it("qualifies title matches on a user-provided board", async () => {
    server.use(
      http.get("https://api.lever.co/v0/postings/northwind", () => HttpResponse.json([job])),
    );
    const result = await findEmployerSource({
      posting,
      boardUrl: "https://jobs.lever.co/northwind",
    });
    expect(result).toMatchObject({ status: "matched", listing: { exactListing: false } });
  });

  it("never renders unsafe listing URLs returned by an upstream", async () => {
    server.use(
      http.get(endpoint, () => HttpResponse.json([{ ...job, hostedUrl: "javascript:alert(1)" }])),
    );
    expect((await findEmployerSource({ posting })).status).toBe("unavailable");
  });

  it("rejects description text at the minimal metadata boundary", async () => {
    await expect(
      findEmployerSource({ posting: { ...posting, descriptionText: "Do not send this" as "" } }),
    ).rejects.toThrow();
  });

  it("normalizes only recognized hosted board links", () => {
    expect(
      identifyBoard("https://job-boards.greenhouse.io/bramblecrest/jobs/42?source=test"),
    ).toMatchObject({
      provider: "greenhouse",
      boardToken: "bramblecrest",
      boardUrl: "https://job-boards.greenhouse.io/bramblecrest",
    });
    expect(identifyBoard("https://jobs.ashbyhq.com/bramblecrest/42")).toMatchObject({
      provider: "ashby",
    });
  });
});
