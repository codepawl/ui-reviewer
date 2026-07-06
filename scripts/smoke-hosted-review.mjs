#!/usr/bin/env node
const endpoint = process.env.UXRAY_HOSTED_ENDPOINT || "https://useuxray.com/v1/reviews/url";
const targetUrl = process.env.TEST_URL || "https://useuxray.com/demo-report.html";

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json", "user-agent": "UXRayHostedSmoke/1.0" },
  body: JSON.stringify({
    url: targetUrl,
    goal: "Review the public UXRay demo report page",
    viewport: ["desktop"],
    strictness: "medium"
  })
});

const payload = await response.json();
if (!response.ok) {
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

const screenshots = payload.rendered_context?.screenshots ?? [];
if (!payload.rendered_context || screenshots.length < 1) {
  console.error(JSON.stringify({ error: "missing_rendered_context", keys: Object.keys(payload), payload }, null, 2));
  process.exit(1);
}

const hasLayoutMetrics = screenshots.every((shot) => shot.layout_metrics);
if (!hasLayoutMetrics) {
  console.error(JSON.stringify({ error: "missing_layout_metrics", screenshots }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  endpoint,
  target_url: targetUrl,
  score: payload.score,
  verdict: payload.verdict,
  screenshot_count: screenshots.length,
  has_layout_metrics: hasLayoutMetrics
}, null, 2));
