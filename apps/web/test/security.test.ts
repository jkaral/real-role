import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import {
  assertPublicUrl,
  fetchPostingPage,
  safeLookup,
  type Resolver,
} from "../src/server/fetch-page";
import { HttpError, assertTrustedOrigin, clientIp } from "../src/server/http";
import { demoAuthAllowed } from "../src/server/demo-auth";

const publicIp = "93.184.216.34";
const resolverFor =
  (...answers: string[][]): Resolver =>
  async () => {
    const next = answers.length > 1 ? answers.shift()! : answers[0]!;
    return next.map((address) => ({ address, family: 4 }));
  };

describe("SSRF: DNS rebinding", () => {
  it("checks the address at connect time, not just before the request", async () => {
    // First lookup (pre-check) says public; the connection's lookup says loopback.
    const rebinding = resolverFor([publicIp], ["127.0.0.1"]);
    const err = await fetchPostingPage("http://jobs.rebind.example/1", rebinding).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).code).toBe("bad_request");
  });

  it("never connects to a private address handed out at connect time", async () => {
    let hits = 0;
    const server = createServer((_req, res) => {
      hits++;
      res.end("<html></html>");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try {
      const lookup = safeLookup(resolverFor(["127.0.0.1"]));
      const result = await new Promise<Error | null>((resolve) =>
        lookup("jobs.rebind.example", {}, (err) => resolve(err)),
      );
      expect(result).toBeInstanceOf(Error);
      expect(hits).toBe(0);
    } finally {
      server.close();
    }
  });

  it("tells unreachable hosts apart from blocked ones", async () => {
    const nxdomain: Resolver = async () => {
      throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    };
    await expect(assertPublicUrl("https://no-such-host.example/", nxdomain)).rejects.toMatchObject({
      code: "upstream_unavailable",
    });
    await expect(
      assertPublicUrl("https://intranet.example/", resolverFor(["10.0.0.5"])),
    ).rejects.toMatchObject({
      code: "bad_request",
    });
  });
});

describe("CSRF: trusted origins for state-changing requests", () => {
  const req = (method: string, headers: Record<string, string>) =>
    new Request("https://real-role.vercel.app/api/applications", { method, headers });

  it("allows same-site, extension and Origin-less requests", () => {
    expect(() =>
      assertTrustedOrigin(
        req("POST", { host: "real-role.vercel.app", origin: "https://real-role.vercel.app" }),
      ),
    ).not.toThrow();
    expect(() =>
      assertTrustedOrigin(
        req("POST", { host: "real-role.vercel.app", origin: "chrome-extension://abc" }),
      ),
    ).not.toThrow();
    expect(() =>
      assertTrustedOrigin(req("DELETE", { host: "real-role.vercel.app" })),
    ).not.toThrow();
    expect(() =>
      assertTrustedOrigin(
        req("GET", { host: "real-role.vercel.app", origin: "https://evil.example" }),
      ),
    ).not.toThrow();
  });

  it("blocks cross-site and opaque origins", () => {
    for (const origin of [
      "https://evil.example",
      "https://real-role.vercel.app.evil.example",
      "null",
    ]) {
      expect(() =>
        assertTrustedOrigin(req("POST", { host: "real-role.vercel.app", origin })),
      ).toThrow(HttpError);
    }
    expect(() =>
      assertTrustedOrigin(
        req("PATCH", { host: "real-role.vercel.app", origin: "https://evil.example" }),
      ),
    ).toThrow(/Cross-site/);
  });
});

describe("rate-limit client id", () => {
  it("prefers the platform-set x-real-ip over a spoofable x-forwarded-for", () => {
    const r = new Request("https://x", {
      headers: { "x-real-ip": "1.1.1.1", "x-forwarded-for": "6.6.6.6" },
    });
    expect(clientIp(r)).toBe("1.1.1.1");
  });
});

describe("demo sign-in never runs on Vercel", () => {
  it("is off in every Vercel environment even with a spoofed localhost Host", () => {
    const on = { ALLOW_DEMO_AUTH: "1" };
    expect(demoAuthAllowed({ ...on, VERCEL: "1" }, "localhost")).toBe(false);
    expect(demoAuthAllowed({ ...on, VERCEL_ENV: "preview" }, "localhost")).toBe(false);
    expect(demoAuthAllowed(on, "localhost")).toBe(true);
    // The local demo pipeline sets VERCEL_ENV=development; that's not Vercel.
    expect(demoAuthAllowed({ ...on, VERCEL_ENV: "development" }, "localhost")).toBe(true);
    expect(demoAuthAllowed({ ...on, VERCEL: "1", VERCEL_ENV: "development" }, "localhost")).toBe(
      false,
    );
  });
});
