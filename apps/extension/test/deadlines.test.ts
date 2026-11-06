import type { ParsedPosting } from "@real-role/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findTracked, saveApplication, scorePosting } from "../src/lib/api";

const posting: ParsedPosting = {
  title: "Platform Engineer",
  company: "Bramblecrest Analytics",
  descriptionText: "Own deployment pipelines.",
  sourceUrl: "https://jobs.lever.co/bramblecrest/42",
  source: "lever",
  parsedBy: "lever",
};

afterEach(() => vi.useRealTimers());

describe("API deadlines", () => {
  it.each(["score", "save", "tracked"])(
    "bounds a stalled %s request and aborts the fetch",
    async (operation) => {
      vi.useFakeTimers();
      let signal: AbortSignal | undefined;
      const stalled = vi.fn<typeof fetch>((_, init) => {
        signal = init?.signal ?? undefined;
        return new Promise(() => {});
      });
      const task =
        operation === "score"
          ? scorePosting(posting, stalled)
          : operation === "save"
            ? saveApplication("p1", stalled)
            : findTracked("p1", stalled);
      const outcome =
        operation === "tracked"
          ? expect(task).resolves.toBeNull()
          : expect(task).rejects.toMatchObject({ code: "timeout" });
      await vi.advanceTimersByTimeAsync(15_000);
      await outcome;
      expect(signal?.aborted).toBe(true);
      expect(stalled).toHaveBeenCalledTimes(1); // Saving is never retried implicitly.
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each([200, 503])("bounds a stalled response body after HTTP %s headers", async (status) => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(new ReadableStream({ start() {} }), { status }),
    );
    const outcome = expect(scorePosting(posting, fetchImpl)).rejects.toMatchObject({
      code: "timeout",
    });
    await vi.advanceTimersByTimeAsync(15_000);
    await outcome;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the deadline when sign-in is required", async () => {
    vi.useFakeTimers();
    await expect(
      saveApplication("p1", async () => new Response(null, { status: 401 })),
    ).resolves.toEqual({ status: "signin" });
    expect(vi.getTimerCount()).toBe(0);
  });
});
