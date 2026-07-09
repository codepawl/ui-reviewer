#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildBenchmarkRunPlan, readJson, writeJson } from "./lib/taste-benchmark.mjs";
import { generateHtmlWithDeepInfra, DEFAULT_DEEPINFRA_MODEL } from "./lib/deepinfra-generator.mjs";
import { buildRepairRun } from "./lib/taste-repair-loop.mjs";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    out[key] = next && !next.startsWith("--") ? next : "1";
    if (next && !next.startsWith("--")) i += 1;
  }
  return out;
}

async function loadOrCreatePlan(args) {
  if (args.plan) return readJson(args.plan);
  const prompts = await readJson(args.prompts || "data/benchmarks/taste-loop-prompts.json");
  const tasteProfiles = await readJson(args.profiles || "data/annotations/taste-profiles.json");
  return buildBenchmarkRunPlan({ prompts, profile: args.profile || "technical_premium", baseProfile: args.baseProfile || "balanced", tasteProfiles });
}

function requireArg(args, name) {
  if (!args[name]) throw new Error(`--${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} is required`);
  return args[name];
}

const args = parseArgs(process.argv.slice(2));
const sourceRoot = args.sourceRoot || "reports/taste-benchmark-routepacks-v2";
const outputRoot = args.outputRoot || "reports/taste-benchmark-actual-repair";
const promptId = requireArg(args, "promptId");
const condition = args.condition || "uxray_repair";
const model = args.model || process.env.DEEPINFRA_MODEL || DEFAULT_DEEPINFRA_MODEL;
const plan = await loadOrCreatePlan(args);
const run = plan.runs.find((item) => item.prompt_id === promptId && item.condition === condition);
if (!run) throw new Error(`No benchmark run found for prompt_id=${promptId} condition=${condition}`);

const sourceHtmlPath = args.sourceHtml || path.join(sourceRoot, promptId, condition, "index.html");
const sourceReviewPath = args.review || path.join(sourceRoot, promptId, condition, "review.json");
if (!existsSync(sourceHtmlPath)) throw new Error(`Source HTML not found: ${sourceHtmlPath}`);
if (!existsSync(sourceReviewPath)) throw new Error(`UXRay review report not found: ${sourceReviewPath}`);

const sourceHtml = await readFile(sourceHtmlPath, "utf8");
const review = await readJson(sourceReviewPath);
const repairRun = buildRepairRun({
  run,
  sourceHtml,
  review,
  issueLimit: Number.parseInt(args.issueLimit || "6", 10),
  repairMode: args.repairMode || "conservative"
});
console.log(`[deepinfra-repair] repairing ${run.run_id} score=${review.score} with ${model}`);
const repairedHtml = await generateHtmlWithDeepInfra(repairRun, {
  apiKey: args.apiKey || process.env.DEEPINFRA_API_KEY,
  model,
  temperature: args.temperature || 0.2,
  maxTokens: args.maxTokens || 9000
});

const htmlPath = args.out || path.join(outputRoot, promptId, condition, "index.html");
await mkdir(path.dirname(htmlPath), { recursive: true });
await writeFile(htmlPath, `${repairedHtml}\n`);
const metaPath = path.join(path.dirname(htmlPath), "repair-generation.json");
await writeJson(metaPath, {
  provider: "deepinfra",
  model,
  source_root: sourceRoot,
  source_html_path: sourceHtmlPath,
  source_review_path: sourceReviewPath,
  source_score: review.score,
  source_issue_count: Array.isArray(review.top_issues) ? review.top_issues.length : null,
  repair_mode: repairRun.repair_source.repair_mode,
  run_id: repairRun.run_id,
  prompt_id: promptId,
  condition,
  html_path: htmlPath,
  generator_prompt: repairRun.generator_prompt,
  generated_at: new Date().toISOString()
});

console.log(JSON.stringify({
  ok: true,
  provider: "deepinfra",
  model,
  source_html_path: sourceHtmlPath,
  source_review_path: sourceReviewPath,
  output_root: outputRoot,
  html_path: htmlPath,
  meta_path: metaPath
}, null, 2));
