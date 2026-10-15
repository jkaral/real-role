import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import type { AtsAdapter, AtsBoard, ParsedPosting } from "@real-role/shared";
import { adapters, ashby, detectBoard, greenhouse, lever, workday } from "../src";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());
const posting: ParsedPosting = {
  title: "Platform Engineer",
  company: "Bramblecrest Analytics",
  location: "Toronto, ON",
  descriptionText: "Maintain the platform.",
  source: "generic",
  parsedBy: "test",
  sourceUrl: "https://bramblecrest.example/jobs/1",
};
const cases: { adapter: AtsAdapter; board: AtsBoard; endpoint: string; payload: unknown }[] = [
  {
    adapter: greenhouse,
    board: {
      provider: "greenhouse",
      boardToken: "bramblecrest",
      boardUrl: "https://boards.greenhouse.io/bramblecrest",
    },
    endpoint: "https://boards-api.greenhouse.io/v1/boards/bramblecrest/jobs",
    payload: {
      jobs: [
        {
          id: 42,
          title: "Platform Engineer",
          location: { name: "Toronto, ON" },
          absolute_url: "https://bramblecrest.example/jobs/42",
          updated_at: "2026-10-01T09:00:00-04:00",
        },
      ],
    },
  },
  {
    adapter: lever,
    board: {
      provider: "lever",
      boardToken: "bramblecrest",
      boardUrl: "https://jobs.lever.co/bramblecrest",
    },
    endpoint: "https://api.lever.co/v0/postings/bramblecrest",
    payload: [
      {
        id: "42",
        text: "Platform Engineer",
        categories: { location: "Toronto, ON" },
        hostedUrl: "https://bramblecrest.example/jobs/42",
      },
    ],
  },
  {
    adapter: ashby,
    board: {
      provider: "ashby",
      boardToken: "bramblecrest",
      boardUrl: "https://jobs.ashbyhq.com/bramblecrest",
    },
    endpoint: "https://api.ashbyhq.com/posting-api/job-board/bramblecrest",
    payload: {
      jobs: [
        {
          title: "Platform Engineer",
          location: "Toronto, ON",
          jobUrl: "https://jobs.ashbyhq.com/bramblecrest/42",
          publishedAt: "2026-10-01T09:00:00Z",
          isListed: true,
        },
      ],
    },
  },
];

describe.each(cases)("$board.provider", ({ adapter, board, endpoint, payload }) => {
  it("detects and validates a board; maps its published roles", async () => {
    server.use(
      http.get(
        endpoint,
        () =>
          new HttpResponse(JSON.stringify(payload), {
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    expect(await adapter.detect(`${board.boardUrl}/jobs/42`)).toEqual(board);
    const roles = await adapter.listOpenRoles(board);
    expect(roles).toHaveLength(1);
    expect(roles[0]).toMatchObject({ id: "42", title: posting.title, provider: adapter.id });
    expect(adapter.findMatch(posting, roles)).toMatchObject({
      matched: true,
      method: "exact_title",
      confidence: 1,
    });
  });
  it.each([404, 429, 500])("returns safely for HTTP %s", async (status) => {
    server.use(http.get(endpoint, () => new HttpResponse(null, { status })));
    expect(await adapter.listOpenRoles(board)).toEqual([]);
    expect(await adapter.detect(board.boardUrl)).toBeNull();
  });
  it("handles malformed JSON and invalid response shapes", async () => {
    server.use(http.get(endpoint, () => new HttpResponse("{broken")));
    expect(await adapter.listOpenRoles(board)).toEqual([]);
    server.use(http.get(endpoint, () => HttpResponse.json({ unexpected: true })));
    expect(await adapter.detect(board.boardUrl)).toBeNull();
  });
  it("recognizes a valid empty board", async () => {
    server.use(
      http.get(endpoint, () => HttpResponse.json(adapter.id === "lever" ? [] : { jobs: [] })),
    );
    expect(await adapter.detect(board.boardUrl)).toEqual(board);
    expect(await adapter.listOpenRoles(board)).toEqual([]);
  });
  it("honors cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await adapter.listOpenRoles(board, { fetch, signal: controller.signal })).toEqual([]);
  });
  it("bounds a stalled request", async () => {
    vi.useFakeTimers();
    // Inject an abort-aware fetch so this timeout test never uses a real network.
    const stalled: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
      );
    const result = adapter.listOpenRoles(board, { fetch: stalled, signal: AbortSignal.timeout(1) });
    await vi.advanceTimersByTimeAsync(10);
    // Node's AbortSignal timeout uses the native timer; yield through a mocked HTTP delay.
    vi.useRealTimers();
    await delay(10);
    expect(await result).toEqual([]);
  });
  it("rejects lookalike hosts and unsafe tokens without I/O", async () => {
    const io = vi.fn<typeof fetch>();
    expect(
      await adapter.detect(
        `${board.boardUrl.replace(".com", ".com.attacker.example").replace(".co/", ".co.attacker.example/").replace(".io/", ".io.attacker.example/")}`,
        { fetch: io },
      ),
    ).toBeNull();
    expect(await adapter.detect("https://bramblecrest.example/careers", { fetch: io })).toBeNull();
    expect(
      await adapter.listOpenRoles({ ...board, boardToken: "../other" }, { fetch: io }),
    ).toEqual([]);
    expect(io).not.toHaveBeenCalled();
  });
});

it("uses the EU Lever API and never invents a posted date", async () => {
  server.use(
    http.get(
      "https://api.eu.lever.co/v0/postings/bramblecrest",
      () =>
        new HttpResponse(JSON.stringify(cases[1]!.payload), {
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
  const board = await lever.detect("https://jobs.eu.lever.co/bramblecrest");
  expect(board).not.toBeNull();
  expect((await lever.listOpenRoles(board!))[0]?.postedAt).toBeUndefined();
});
it("does not publish unlisted Ashby roles", async () => {
  server.use(
    http.get(cases[2]!.endpoint, () =>
      HttpResponse.json({
        jobs: [
          {
            title: "Internal role",
            jobUrl: "https://bramblecrest.example/jobs/hidden",
            isListed: false,
          },
        ],
      }),
    ),
  );
  expect(await ashby.listOpenRoles(cases[2]!.board)).toEqual([]);
});
it("matches fuzzy titles while rejecting conflicting locations and unrelated roles", () => {
  const role = {
    provider: "greenhouse" as const,
    id: "42",
    title: "Senior Platform Engineer",
    location: "Toronto, ON",
    url: posting.sourceUrl,
  };
  expect(greenhouse.findMatch(posting, [role])).toMatchObject({
    matched: true,
    method: "fuzzy_title",
  });
  expect(greenhouse.findMatch(posting, [{ ...role, location: "Austin, TX" }]).matched).toBe(false);
  expect(greenhouse.findMatch(posting, [{ ...role, title: "Account Manager" }]).matched).toBe(
    false,
  );
  expect(greenhouse.findMatch(posting, [{ ...role, location: undefined }]).confidence).toBeLessThan(
    0.8,
  );
  expect(
    greenhouse.findMatch({ ...posting, source: "greenhouse", externalId: "42" }, [role]).method,
  ).toBe("external_id");
  expect(
    greenhouse.findMatch({ ...posting, source: "lever", externalId: "42" }, [
      { ...role, title: "Other" },
    ]).matched,
  ).toBe(false);
});
it("keeps the required exports and isolates failing candidate adapters", async () => {
  expect(adapters.map((a) => a.id)).toEqual(["greenhouse", "lever", "ashby"]);
  expect(await detectBoard("bramblecrest.example")).toBeNull();
  expect(
    await detectBoard("anything", undefined, [
      {
        ...workday,
        detect: async () => {
          throw new Error("offline");
        },
      },
    ]),
  ).toBeNull();
  expect(await workday.detect("bramblecrest.example")).toBeNull();
});
