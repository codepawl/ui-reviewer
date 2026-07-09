#!/usr/bin/env node
import assert from "node:assert/strict";
import { buildBenchmarkRunPlan } from "./lib/taste-benchmark.mjs";
import { buildRepairRun, chooseBestRepairIteration, compactReviewIssues, repairLoopDecision, repairModeForIteration } from "./lib/taste-repair-loop.mjs";

const prompts = [{
  id: "agent_chat_ui",
  route_type: "app_shell",
  product_goal: "Design an agent chat interface that shows tool progress, pending states, and repair evidence.",
  audience: "operators supervising AI coding agents",
  primary_task: "Understand what the agent is doing and intervene if needed"
}];
const plan = buildBenchmarkRunPlan({ prompts, profile: "technical_premium", baseProfile: "balanced" });
const run = plan.runs.find((item) => item.prompt_id === "agent_chat_ui" && item.condition === "uxray_repair");
const review = {
  score: 62,
  verdict: "major UI/UX risks detected",
  top_issues: [
    { severity: "high", category: "accessibility", evidence: "button contrast 2.77:1 < 4.5:1", fix: "Use high-contrast neutral buttons." },
    { severity: "medium", category: "content_density", evidence: "939 chars but only 3 headings", fix: "Add section headings and split dense copy." },
    { severity: "medium", category: "content_density", evidence: "crowded regions desktop: 3/2", fix: "Reduce above-fold crowding." },
    { severity: "low", category: "visual_hierarchy", evidence: "dominant font family only", fix: "Minor polish." }
  ]
};

const compact = compactReviewIssues(review, { limit: 3 });
assert.equal(compact.length, 3);
assert.equal(compact[0].severity, "high");
assert.match(compact[0].evidence, /contrast/);

const sourceHtml = "<!doctype html><html><body><main><h1>Agent Coding Session</h1><button>Retry</button></main></body></html>";
const repairRun = buildRepairRun({ run, sourceHtml, review });
assert.equal(repairRun.run_id, "agent_chat_ui__uxray_repair__actual_repair");
assert.match(repairRun.generator_prompt, /Actual UXRay repair loop/);
assert.match(repairRun.generator_prompt, /Original UXRay score: 62/);
assert.match(repairRun.generator_prompt, /button contrast 2.77:1/);
assert.match(repairRun.generator_prompt, /For accessibility contrast issues/);
assert.match(repairRun.generator_prompt, /replace low-contrast yellow, green, red, or pale accent buttons/);
assert.match(repairRun.generator_prompt, /For action-density issues/);
assert.match(repairRun.generator_prompt, /For content-density issues/);
assert.match(repairRun.generator_prompt, /add at least two visible H2 or H3 labels/);
assert.match(repairRun.generator_prompt, /No more than 3 above-fold action buttons/);
assert.match(repairRun.generator_prompt, /Do not use a landing-page hero/);
assert.match(repairRun.generator_prompt, /Return only one complete corrected HTML document/);
assert.match(repairRun.generator_prompt, /<main><h1>Agent Coding Session/);

const structuralRun = buildRepairRun({ run, sourceHtml, review, repairMode: "structural" });
assert.equal(structuralRun.repair_source.repair_mode, "structural");
assert.match(structuralRun.generator_prompt, /Structural repair mode/);
assert.match(structuralRun.generator_prompt, /rewrite the layout structure/);
assert.match(structuralRun.generator_prompt, /reduce above-fold crowded regions/);

assert.deepEqual(repairLoopDecision({ score: 86, highIssues: 0, previousScore: 62, iteration: 1, maxIterations: 3, targetScore: 90 }), {
  stop: false,
  reason: "continue: score improved and target not reached"
});
assert.deepEqual(repairLoopDecision({ score: 92, highIssues: 0, previousScore: 86, iteration: 2, maxIterations: 3, targetScore: 90 }), {
  stop: true,
  reason: "target_score_reached"
});
assert.deepEqual(repairLoopDecision({ score: 86, highIssues: 0, previousScore: 86, iteration: 2, maxIterations: 3, targetScore: 90 }), {
  stop: true,
  reason: "no_score_improvement"
});
assert.deepEqual(repairLoopDecision({ score: 62, highIssues: 1, previousScore: 62, iteration: 1, maxIterations: 3, targetScore: 90, allowStructuralRetry: true }), {
  stop: false,
  reason: "continue: escalate to structural repair"
});
assert.deepEqual(repairLoopDecision({ score: 80, highIssues: 0, previousScore: 62, iteration: 3, maxIterations: 3, targetScore: 90 }), {
  stop: true,
  reason: "max_iterations_reached"
});
assert.deepEqual(chooseBestRepairIteration([
  { iteration: 1, score: 80, high_issue_count: 0, review_path: "iter-1/review.json" },
  { iteration: 2, score: 68, high_issue_count: 1, review_path: "iter-2/review.json" }
]), { iteration: 1, score: 80, high_issue_count: 0, review_path: "iter-1/review.json" });
assert.equal(repairModeForIteration({ iteration: 1, previousReview: review, defaultMode: "auto" }), "conservative");
assert.equal(repairModeForIteration({ iteration: 2, previousReview: { score: 80, top_issues: review.top_issues.filter((issue) => issue.category === "content_density") }, defaultMode: "auto" }), "structural");
console.log("taste repair loop tests passed");
