import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const url = process.env.TEST_URL;
if (!url) {
  console.error("TEST_URL is required, e.g. TEST_URL=http://127.0.0.1:4173 npm run review:url");
  process.exit(2);
}

const label = process.env.REVIEW_LABEL || "review";
const outputDir = process.env.REVIEW_OUTPUT_DIR || "reports/reviews";
const returnImages = process.env.RETURN_IMAGES === "1";
const useVision = process.env.USE_VISION === "1";
const tasteProfile = process.env.REVIEW_TASTE_PROFILE || "balanced";

const transport = new StdioClientTransport({
  command: "npm",
  args: ["--silent", "run", "mcp"],
  cwd: process.cwd(),
  env: process.env
});

const client = new Client({
  name: "uxray-review-url-client",
  version: "0.4.0"
});

await client.connect(transport);

const toolResult = await client.callTool({
  name: "review_ui_url",
  arguments: {
    url,
    goal: process.env.REVIEW_GOAL || "Landing page for UXRay, an MCP UI review tool that helps coding agents fix AI-generated frontend UX problems",
    audience: process.env.REVIEW_AUDIENCE || "technical founders and developers using Codex, Lovable, Bolt, and Claude Code",
    viewport: ["desktop", "mobile"],
    strictness: "high",
    taste_profile: tasteProfile,
    use_vision: useVision,
    return_images: returnImages
  }
});

const textContent = toolResult.content.find((item) => item.type === "text" && item.text?.trim().startsWith("{"));
if (!textContent) {
  console.error("No JSON text content returned by review_ui_url");
  console.log(JSON.stringify(toolResult, null, 2));
  process.exit(1);
}

const report = JSON.parse(textContent.text);
await mkdir(outputDir, { recursive: true });
const reportPath = path.join(outputDir, `${label}.json`);
await writeFile(reportPath, JSON.stringify(report, null, 2));

const summary = {
  label,
  score: report.score,
  verdict: report.verdict,
  product_stage: report.product_stage,
  issue_count: report.top_issues?.length ?? 0,
  high_issue_count: report.top_issues?.filter((issue) => issue.severity === "high").length ?? 0,
  first_issue_category: report.top_issues?.[0]?.category ?? null,
  first_issue: report.top_issues?.[0]?.evidence ?? null,
  screenshot_count: report.rendered_context?.screenshots?.length ?? 0,
  report_path: reportPath
};

console.log(JSON.stringify(summary, null, 2));
await client.close();
