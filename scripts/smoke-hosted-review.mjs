#!/usr/bin/env node
const endpoint = process.env.UXRAY_HOSTED_ENDPOINT || "https://useuxray.com/v1/reviews/url";
const targetUrl = process.env.TEST_URL || "https://useuxray.com/demo-report.html";
const baseUrl = new URL(endpoint).origin;

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json", "user-agent": "UXRayHostedSmoke/1.0" },
  body: JSON.stringify({
    url: targetUrl,
    goal: "Review the public UXRay demo report page for an AI builder evaluating the hosted report flow and saved share link.",
    audience: "AI builders and frontend agents using UXRay hosted reviews",
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

if (!payload.saved || !payload.report_id || !payload.report_url || !payload.share_url) {
  console.error(JSON.stringify({ error: "missing_saved_report_fields", report_id: payload.report_id, report_url: payload.report_url, share_url: payload.share_url, saved: payload.saved }, null, 2));
  process.exit(1);
}

const firstScreenshot = screenshots[0];
if (!firstScreenshot.screenshot_url || firstScreenshot.data_base64) {
  console.error(JSON.stringify({ error: "screenshot_not_persisted", firstScreenshot }, null, 2));
  process.exit(1);
}

const reportApi = await fetch(`${baseUrl}/v1/reports/${payload.report_id}`, { headers: { "user-agent": "UXRayHostedSmoke/1.0" } });
if (!reportApi.ok) {
  console.error(JSON.stringify({ error: "report_api_failed", status: reportApi.status, text: await reportApi.text() }, null, 2));
  process.exit(1);
}

const screenshotResponse = await fetch(firstScreenshot.screenshot_url, { headers: { "user-agent": "UXRayHostedSmoke/1.0" } });
if (!screenshotResponse.ok || !String(screenshotResponse.headers.get("content-type") || "").startsWith("image/")) {
  console.error(JSON.stringify({ error: "screenshot_fetch_failed", status: screenshotResponse.status, content_type: screenshotResponse.headers.get("content-type") }, null, 2));
  process.exit(1);
}

const reportPage = await fetch(payload.share_url, { headers: { "user-agent": "UXRayHostedSmoke/1.0" } });
const reportHtml = await reportPage.text();
if (!reportPage.ok || !reportHtml.includes("Saved hosted report")) {
  console.error(JSON.stringify({ error: "report_page_failed", status: reportPage.status, preview: reportHtml.slice(0, 240) }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  endpoint,
  target_url: targetUrl,
  report_id: payload.report_id,
  share_url: payload.share_url,
  score: payload.score,
  verdict: payload.verdict,
  screenshot_count: screenshots.length,
  has_layout_metrics: hasLayoutMetrics,
  screenshot_content_type: screenshotResponse.headers.get("content-type")
}, null, 2));
