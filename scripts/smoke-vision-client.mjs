import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const url = process.env.TEST_URL;
if (!url) {
  console.error("TEST_URL is required, e.g. TEST_URL=http://127.0.0.1:4173 npm run smoke:vision");
  process.exit(2);
}

if (!process.env.OPENAI_API_KEY && process.env.LOAD_CODEX_OPENAI_KEY === "1") {
  try {
    const auth = JSON.parse(await readFile("/home/nxank4/.codex/auth.json", "utf8"));
    if (auth.OPENAI_API_KEY) process.env.OPENAI_API_KEY = auth.OPENAI_API_KEY;
  } catch {
    // Keep fallback behavior; the MCP server will report vision not configured.
  }
}

console.log(`VISION_KEY_CONFIGURED=${Boolean(process.env.OPENAI_API_KEY)}`);
console.log(`VISION_MODEL=${process.env.OPENAI_VISION_MODEL || "gpt-4o-mini"}`);

const transport = new StdioClientTransport({
  command: "npm",
  args: ["run", "mcp"],
  cwd: process.cwd(),
  env: process.env
});

const client = new Client({
  name: "ui-reviewer-vision-smoke-client",
  version: "0.3.0"
});

await client.connect(transport);

const review = await client.callTool({
  name: "review_ui_url",
  arguments: {
    url,
    goal: "Landing page for an MCP UI reviewer that helps coding agents fix AI-generated frontend UX problems",
    audience: "technical founders and developers using Codex, Lovable, Bolt, and Claude Code",
    viewport: ["desktop", "mobile"],
    strictness: "high",
    use_vision: true,
    vision_model: process.env.OPENAI_VISION_MODEL
  }
});
console.log(JSON.stringify(review, null, 2));

await client.close();
