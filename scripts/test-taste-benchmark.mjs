#!/usr/bin/env node
import assert from "node:assert/strict";
import { buildBenchmarkRunPlan, summarizeBenchmarkReports } from "./lib/taste-benchmark.mjs";

const prompts = [
  {
    id: "landing_ai_code_review",
    route_type: "landing",
    product_goal: "Explain an AI code review tool that finds risky frontend changes before merge.",
    audience: "technical founders and senior frontend engineers",
    primary_task: "Start a review on a repository URL",
    slop_risks: ["generic SaaS cards", "fake productivity stats"]
  },
  {
    id: "dashboard_empty_state",
    route_type: "dashboard",
    product_goal: "Guide a new user through connecting their first project to an AI UI review dashboard.",
    audience: "developer tool users",
    primary_task: "Connect first project",
    slop_risks: ["too many setup cards", "unclear primary CTA"]
  },
  {
    id: "agent_chat_ui",
    route_type: "app_shell",
    product_goal: "Design an agent chat interface that shows tool progress, pending states, and repair evidence.",
    audience: "operators supervising AI coding agents",
    primary_task: "Understand what the agent is doing and intervene if needed"
  },
  {
    id: "news_radar_homepage",
    route_type: "editorial_homepage",
    product_goal: "Show a frequent AI/news radar homepage with scannable live stories and concise context.",
    audience: "busy AI builders checking what matters today",
    primary_task: "Scan current stories and open the most relevant one"
  },
  {
    id: "auth_magic_link",
    route_type: "auth",
    product_goal: "Let a user request a magic link and understand sent, expired, and error states.",
    audience: "new UXRay account users",
    primary_task: "Submit email and recover from link issues"
  }
];

const plan = buildBenchmarkRunPlan({ prompts, profile: "technical_premium", baseProfile: "balanced" });
assert.equal(plan.schema_version, "uxray.taste_benchmark_plan.v1");
assert.equal(plan.prompts.length, 5);
assert.equal(plan.runs.length, 15);
assert.deepEqual(plan.runs.map((run) => run.condition).slice(0, 3), ["baseline", "taste_context", "uxray_repair"]);
assert.match(plan.runs[1].generator_prompt, /Taste profile: technical_premium/);
assert.match(plan.runs[1].generator_prompt, /Avoid/);
assert.match(plan.runs[1].generator_prompt, /Mobile must render without horizontal overflow/);
assert.match(plan.runs[1].generator_prompt, /If the UI includes forms/);
assert.match(plan.runs[1].generator_prompt, /Do not rely on placeholder text or hidden JavaScript/);
assert.match(plan.runs[1].generator_prompt, /No fake metrics/);
assert.match(plan.runs[1].generator_prompt, /All interactive targets must be at least 44×44/);
assert.match(plan.runs[1].generator_prompt, /Peer cards must use equal-height/);
assert.match(plan.runs[1].generator_prompt, /Text and action contrast must be at least 4.5:1/);
assert.match(plan.runs[1].generator_prompt, /H1 must be a descriptive outcome statement/);
assert.match(plan.runs[2].generator_prompt, /Run UXRay/);
assert.match(plan.runs[2].generator_prompt, /Generate the post-repair HTML directly/);
assert.match(plan.runs[2].generator_prompt, /Mobile must render without horizontal overflow/);
assert.match(plan.runs[2].generator_prompt, /If the UI includes forms/);
assert.match(plan.runs[2].generator_prompt, /No heading level jumps/);

const run = (promptId, condition = "taste_context") => plan.runs.find((item) => item.prompt_id === promptId && item.condition === condition);
assert.match(run("agent_chat_ui").generator_prompt, /Route-specific constraints for app_shell/);
assert.match(run("agent_chat_ui").generator_prompt, /Do not use a landing-page hero/);
assert.match(run("agent_chat_ui").generator_prompt, /visible tool progress/);
assert.match(run("agent_chat_ui").generator_prompt, /No more than 3 above-fold action buttons/);
assert.match(run("agent_chat_ui").generator_prompt, /Avoid yellow, green, or red text-only action buttons/);
assert.match(run("news_radar_homepage", "uxray_repair").generator_prompt, /Route-specific constraints for editorial_homepage/);
assert.match(run("news_radar_homepage", "uxray_repair").generator_prompt, /Prioritize story scanning above signup/);
assert.match(run("auth_magic_link").generator_prompt, /Route-specific constraints for auth/);
assert.match(run("auth_magic_link").generator_prompt, /Show sent, expired, invalid email, and resend states/);
assert.match(run("auth_magic_link").generator_prompt, /H1 must describe the outcome/);
assert.match(run("auth_magic_link").generator_prompt, /button and recovery link must each be at least 44×44/);

const summary = summarizeBenchmarkReports([
  { prompt_id: "landing_ai_code_review", condition: "baseline", report: { score: 65, top_issues: [{ severity: "high", category: "task_flow" }, { severity: "medium", category: "content_density" }] } },
  { prompt_id: "landing_ai_code_review", condition: "taste_context", report: { score: 82, top_issues: [{ severity: "medium", category: "content_density" }] } },
  { prompt_id: "landing_ai_code_review", condition: "uxray_repair", report: { score: 91, top_issues: [] } }
]);
assert.equal(summary.conditions.baseline.avg_score, 65);
assert.equal(summary.conditions.baseline.avg_high_issues, 1);
assert.equal(summary.conditions.taste_context.avg_score_delta_vs_baseline, 17);
assert.equal(summary.conditions.uxray_repair.avg_high_issue_delta_vs_baseline, -1);
console.log("taste benchmark tests passed");
