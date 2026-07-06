import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npm",
  args: ["run", "mcp"],
  cwd: process.cwd()
});

const client = new Client({
  name: "ui-reviewer-smoke-client",
  version: "0.1.0"
});

await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS", tools.tools.map((tool) => tool.name).join(","));

const health = await client.callTool({ name: "health_check", arguments: {} });
console.log("HEALTH", JSON.stringify(health));

const review = await client.callTool({
  name: "review_ui_url",
  arguments: {
    url: "http://localhost:3000",
    goal: "Landing page for an MCP UI reviewer that helps coding agents fix AI-generated frontend UX problems",
    audience: "technical founders and developers using Codex, Lovable, Bolt, and Claude Code",
    viewport: ["desktop", "mobile"],
    strictness: "high",
    skip_render: true
  }
});
console.log("REVIEW", JSON.stringify(review));

await client.close();
