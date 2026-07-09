#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildBenchmarkRunPlan } from "./lib/taste-benchmark.mjs";
import { conditionFixtureHtml, materializeBenchmarkFixtures, reviewCommandForRun } from "./lib/taste-benchmark-runner.mjs";

const prompts = [
  {
    id: "landing_ai_code_review",
    route_type: "landing",
    product_goal: "Explain an AI code review tool that finds risky frontend changes before merge.",
    audience: "technical founders and senior frontend engineers",
    primary_task: "Start a review on a repository URL",
    slop_risks: ["generic SaaS cards", "fake productivity stats"]
  }
];
const profile = {
  technical_premium: {
    base_profile: "balanced",
    prefer: ["specific workflow copy", "clear mechanism explanation"],
    avoid: ["card soup", "generic SaaS filler", "decorative gradients"]
  }
};
const plan = buildBenchmarkRunPlan({ prompts, profile: "technical_premium", tasteProfiles: profile });

const baselineHtml = conditionFixtureHtml({ run: plan.runs[0], prompt: plan.prompts[0], condition: "baseline" });
assert.match(baselineHtml, /supercharge/i);
assert.match(baselineHtml, /Unlock/i);
assert.match(baselineHtml, /card soup/i);

const tasteHtml = conditionFixtureHtml({ run: plan.runs[1], prompt: plan.prompts[0], condition: "taste_context" });
assert.match(tasteHtml, /specific workflow copy/i);
assert.doesNotMatch(tasteHtml, /supercharge/i);

const repairHtml = conditionFixtureHtml({ run: plan.runs[2], prompt: plan.prompts[0], condition: "uxray_repair" });
assert.match(repairHtml, /UXRay repair-ready/i);
assert.doesNotMatch(repairHtml, /generic SaaS filler/i);

const dir = await mkdtemp(path.join(tmpdir(), "uxray-taste-runner-"));
try {
  const materialized = await materializeBenchmarkFixtures(plan, { outputRoot: dir });
  assert.equal(materialized.length, 3);
  const firstHtml = await readFile(path.join(dir, "landing_ai_code_review", "baseline", "index.html"), "utf8");
  assert.match(firstHtml, /landing_ai_code_review/);

  const command = reviewCommandForRun(plan.runs[0], { port: 43191, rootDir: dir });
  assert.match(command.command, /npm run review:url/);
  assert.equal(command.env.TEST_URL, "http://127.0.0.1:43191/landing_ai_code_review/baseline/index.html");
  assert.equal(command.env.REVIEW_LABEL, "review");
  assert.equal(command.env.REVIEW_OUTPUT_DIR, path.join(dir, "landing_ai_code_review", "baseline"));
  console.log("taste benchmark runner tests passed");
} finally {
  await rm(dir, { recursive: true, force: true });
}
