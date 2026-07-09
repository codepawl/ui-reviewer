#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import path from "node:path";
import { buildBenchmarkRunPlan, readJson, summarizeBenchmarkReports, writeJson } from "./lib/taste-benchmark.mjs";

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

async function collectReports(reportDir) {
  const items = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name === "review.json") {
        const parts = full.split(path.sep);
        const condition = parts.at(-2);
        const promptId = parts.at(-3);
        items.push({ prompt_id: promptId, condition, report_path: full, report: await readJson(full) });
      }
    }
  }
  await walk(reportDir);
  return items;
}

const args = parseArgs(process.argv.slice(2));
const promptsPath = args.prompts || "data/benchmarks/taste-loop-prompts.json";
const profilesPath = args.profiles || "data/annotations/taste-profiles.json";
const outPath = args.out || "reports/taste-benchmark/run-plan.json";
const summaryOut = args.summaryOut || "reports/taste-benchmark/summary.json";

if (args.summarize) {
  const items = await collectReports(args.summarize);
  const summary = summarizeBenchmarkReports(items);
  await writeJson(summaryOut, summary);
  console.log(JSON.stringify({ ok: true, mode: "summarize", runs: items.length, summary_path: summaryOut, summary }, null, 2));
  process.exit(0);
}

const prompts = await readJson(promptsPath);
const tasteProfiles = await readJson(profilesPath);
const plan = buildBenchmarkRunPlan({
  prompts,
  profile: args.profile || "technical_premium",
  baseProfile: args.baseProfile || "balanced",
  tasteProfiles
});
await writeJson(outPath, plan);
console.log(JSON.stringify({
  ok: true,
  mode: "plan",
  profile: plan.profile,
  prompts: plan.prompts.length,
  runs: plan.runs.length,
  conditions: plan.conditions,
  plan_path: outPath,
  next: "Use each run.generator_prompt to generate UI artifacts, then run UXRay review:url and later call npm run benchmark:taste -- --summarize reports/taste-benchmark"
}, null, 2));
