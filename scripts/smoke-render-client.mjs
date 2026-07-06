import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const url = process.env.TEST_URL;
if (!url) {
  console.error("TEST_URL is required, e.g. TEST_URL=http://127.0.0.1:4173 npm run smoke:render");
  process.exit(2);
}

const transport = new StdioClientTransport({
  command: "npm",
  args: ["run", "mcp"],
  cwd: process.cwd()
});

const client = new Client({
  name: "ui-reviewer-render-smoke-client",
  version: "0.2.0"
});

await client.connect(transport);

const review = await client.callTool({
  name: "review_ui_url",
  arguments: {
    url,
    goal: "Landing page for an MCP UI reviewer that helps coding agents fix AI-generated frontend UX problems",
    audience: "technical founders and developers using Codex, Lovable, Bolt, and Claude Code",
    viewport: ["desktop", "mobile"],
    strictness: "high"
  }
});
console.log(JSON.stringify(review, null, 2));

await client.close();
