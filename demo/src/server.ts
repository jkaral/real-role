import { createServer } from "node:http";
import { scenarios, fixtureHtml } from "./fixtures";

export async function startFixtureServer(now = new Date()) {
  const fixtures = scenarios(now);
  const server = createServer((req, res) => {
    const scenario = fixtures.find((item) => req.url?.split("?")[0] === `/jobs/${item.slug}`);
    if (!scenario) {
      res.writeHead(404);
      res.end("Fixture not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(fixtureHtml(scenario));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(4173, "127.0.0.1", resolve);
  });
  return {
    fixtures,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
