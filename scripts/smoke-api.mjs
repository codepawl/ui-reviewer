import { readFile } from "node:fs/promises";

const apiBase = process.env.API_BASE ?? "http://127.0.0.1:4317";
const testUrl = process.env.TEST_URL ?? "http://127.0.0.1:4173";

async function getJson(path) {
  const response = await fetch(`${apiBase}${path}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function postJson(path, body) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

const health = await getJson("/health");
console.log("HEALTH", JSON.stringify({ ok: health.ok, service: health.service, stage: health.stage }));

const review = await postJson("/v1/reviews/url", {
  url: testUrl,
  goal: "Landing page for UXRay, an MCP UI review tool that helps coding agents fix AI-generated frontend UX problems",
  audience: "technical founders and developers using Codex, Lovable, Bolt, and Claude Code",
  viewport: ["desktop", "mobile"],
  strictness: "high"
});
console.log(
  "URL_REVIEW",
  JSON.stringify({
    score: review.score,
    verdict: review.verdict,
    issue_count: review.top_issues.length,
    screenshot_count: review.rendered_context?.screenshots?.length ?? 0
  })
);

const before = JSON.parse(await readFile("reports/reviews/before.json", "utf8"));
const after = JSON.parse(await readFile("reports/reviews/after.json", "utf8"));
const diff = await postJson("/v1/reviews/diff", { before, after, label: "api-smoke" });
console.log(
  "DIFF",
  JSON.stringify({
    verdict: diff.verdict,
    score_delta: diff.score_delta,
    high_severity_delta: diff.high_severity_delta,
    fixed_issue_categories: diff.fixed_issue_categories
  })
);
