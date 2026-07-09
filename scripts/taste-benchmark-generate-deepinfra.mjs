#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildBenchmarkRunPlan, readJson, writeJson } from "./lib/taste-benchmark.mjs";
import { generateHtmlWithDeepInfra, DEFAULT_DEEPINFRA_MODEL } from "./lib/deepinfra-generator.mjs";

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

function artifactPathForRun(run, outputRoot) {
  if (!outputRoot) return run.expected_artifacts.html_path;
  return path.join(outputRoot, run.prompt_id, run.condition, "index.html");
}

const args = parseArgs(process.argv.slice(2));
const outputRoot = args.outputRoot || "reports/taste-benchmark-deepinfra";
const planOut = args.planOut || path.join(outputRoot, "run-plan.json");
const model = args.model || process.env.DEEPINFRA_MODEL || DEFAULT_DEEPINFRA_MODEL;
const limit = Number.parseInt(args.limit || "1", 10);
const plan = await loadOrCreatePlan(args);
await writeJson(planOut, plan);
const selected = plan.runs
  .filter((run) => !args.condition || run.condition === args.condition)
  .filter((run) => !args.promptId || run.prompt_id === args.promptId)
  .slice(0, Number.isFinite(limit) && limit > 0 ? limit : plan.runs.length);

const generated = [];
for (const run of selected) {
  console.log(`[deepinfra] generating ${run.run_id} with ${model}`);
  const html = await generateHtmlWithDeepInfra(run, {
    apiKey: args.apiKey || process.env.DEEPINFRA_API_KEY,
    model,
    temperature: args.temperature || 0.25,
    maxTokens: args.maxTokens || 6500
  });
  const htmlPath = artifactPathForRun(run, outputRoot);
  await mkdir(path.dirname(htmlPath), { recursive: true });
  await writeFile(htmlPath, `${html}\n`);
  const metaPath = path.join(path.dirname(htmlPath), "generation.json");
  await writeJson(metaPath, {
    provider: "deepinfra",
    model,
    run_id: run.run_id,
    prompt_id: run.prompt_id,
    condition: run.condition,
    html_path: htmlPath,
    generator_prompt: run.generator_prompt,
    generated_at: new Date().toISOString()
  });
  generated.push({ run_id: run.run_id, html_path: htmlPath, meta_path: metaPath });
}

console.log(JSON.stringify({
  ok: true,
  provider: "deepinfra",
  model,
  plan_path: planOut,
  output_root: outputRoot,
  generated
}, null, 2));
