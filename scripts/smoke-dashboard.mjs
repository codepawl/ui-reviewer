#!/usr/bin/env node
const baseUrl = process.env.UXRAY_BASE_URL || "https://useuxray.com";

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { "user-agent": "UXRayDashboardSmoke/1.0" } });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

const dashboard = await getJson("/v1/account/dashboard");
if (!dashboard.ok) throw new Error("dashboard ok=false");
if (!dashboard.totals || typeof dashboard.totals.report_count !== "number") throw new Error("missing totals.report_count");
if (!dashboard.usage || typeof dashboard.usage.credits_remaining !== "number") throw new Error("missing usage credits");
if (!Array.isArray(dashboard.achievements) || dashboard.achievements.length < 4) throw new Error("missing achievements");
if (!Array.isArray(dashboard.advanced_features) || dashboard.advanced_features.length < 4) throw new Error("missing advanced feature bets");
if (!dashboard.advanced_features.some((feature) => String(feature.name || "").includes("Agent CI Firewall"))) {
  throw new Error("missing Agent CI Firewall feature bet");
}

const skill = await fetch(`${baseUrl}/plugins/uxray-agent-skill.md`, { headers: { "user-agent": "UXRayDashboardSmoke/1.0" } });
if (!skill.ok) throw new Error(`skill returned ${skill.status}`);
const skillText = await skill.text();
for (const required of ["Auto-trigger rules", "return_images", "review_ui_diff", "Do not wait for the user to explicitly say"]) {
  if (!skillText.includes(required)) throw new Error(`skill missing ${required}`);
}

console.log(JSON.stringify({
  ok: true,
  base_url: baseUrl,
  report_count: dashboard.totals.report_count,
  achievements: dashboard.achievements.length,
  advanced_features: dashboard.advanced_features.length,
  first_feature: dashboard.advanced_features[0]?.name
}, null, 2));
