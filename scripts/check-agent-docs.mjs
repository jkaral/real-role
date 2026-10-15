// CLAUDE.md and AGENTS.md must stay identical (A7). CI runs this.
import { readFileSync } from "node:fs";

const claude = readFileSync(new URL("../CLAUDE.md", import.meta.url), "utf8");
const agents = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");

if (claude !== agents) {
  console.error("CLAUDE.md and AGENTS.md differ. Edit CLAUDE.md, then copy it to AGENTS.md.");
  process.exit(1);
}
console.log("CLAUDE.md and AGENTS.md are identical.");
