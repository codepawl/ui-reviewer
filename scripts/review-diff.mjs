import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const beforeReportPath = process.env.BEFORE_REPORT || "reports/reviews/before.json";
const afterReportPath = process.env.AFTER_REPORT || "reports/reviews/after.json";
const label = process.env.DIFF_LABEL || "repair-loop";

const transport = new StdioClientTransport({
  command: "npm",
  args: ["run", "mcp"],
  cwd: process.cwd(),
  env: process.env
});

const client = new Client({
  name: "ui-reviewer-diff-client",
  version: "0.5.0"
});

await client.connect(transport);

const diff = await client.callTool({
  name: "review_ui_diff",
  arguments: {
    before_report_path: beforeReportPath,
    after_report_path: afterReportPath,
    label
  }
});

console.log(JSON.stringify(diff, null, 2));
await client.close();
