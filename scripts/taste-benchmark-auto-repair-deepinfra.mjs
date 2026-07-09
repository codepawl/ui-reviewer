#!/usr/bin/env node
import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { buildBenchmarkRunPlan, readJson, writeJson } from "./lib/taste-benchmark.mjs";
import { reviewCommandForRun } from "./lib/taste-benchmark-runner.mjs";
import { generateHtmlWithDeepInfra, DEFAULT_DEEPINFRA_MODEL } from "./lib/deepinfra-generator.mjs";
import { buildRepairRun, chooseBestRepairIteration, repairLoopDecision, repairModeForIteration } from "./lib/taste-repair-loop.mjs";

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

function requireArg(args, name) {
  if (!args[name]) throw new Error(`--${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} is required`);
  return args[name];
}

async function loadOrCreatePlan(args) {
  if (args.plan) return readJson(args.plan);
  const prompts = await readJson(args.prompts || "data/benchmarks/taste-loop-prompts.json");
  const tasteProfiles = await readJson(args.profiles || "data/annotations/taste-profiles.json");
  return buildBenchmarkRunPlan({ prompts, profile: args.profile || "technical_premium", baseProfile: args.baseProfile || "balanced", tasteProfiles });
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

async function startStaticServer(rootDir, port) {
  const root = path.resolve(rootDir);
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
      const decoded = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      const requested = path.resolve(root, decoded || "index.html");
      if (!requested.startsWith(root) || !existsSync(requested)) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": contentType(requested) });
      createReadStream(requested).pipe(res);
    } catch (error) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(error instanceof Error ? error.message : String(error));
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}

function runCommand(command, env) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; process.stdout.write(chunk); });
    child.stderr.on("data", (chunk) => { stderr += chunk; process.stderr.write(chunk); });
    child.on("close", (code) => resolve({ exit_code: code, stdout, stderr }));
  });
}

function issueCount(report) {
  const issues = Array.isArray(report.top_issues) ? report.top_issues : [];
  return { issue_count: issues.length, high_issue_count: issues.filter((issue) => issue.severity === "high").length };
}

async function reviewHtml({ run, outputRoot, port }) {
  const server = await startStaticServer(outputRoot, port);
  try {
    const spec = reviewCommandForRun(run, { port, rootDir: outputRoot });
    await mkdir(spec.env.REVIEW_OUTPUT_DIR, { recursive: true });
    const result = await runCommand(spec.command, spec.env);
    if (result.exit_code !== 0) throw new Error(`review:url failed with exit ${result.exit_code}`);
    return readJson(path.join(spec.env.REVIEW_OUTPUT_DIR, "review.json"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const args = parseArgs(process.argv.slice(2));
const promptId = requireArg(args, "promptId");
const condition = args.condition || "uxray_repair";
const sourceRoot = args.sourceRoot || "reports/taste-benchmark-routepacks-v2";
const outputRoot = args.outputRoot || "reports/taste-benchmark-auto-repair";
const maxIterations = Number.parseInt(args.maxIterations || "3", 10);
const targetScore = Number.parseInt(args.targetScore || "90", 10);
const repairMode = args.repairMode || "auto";
const port = Number.parseInt(args.port || "43210", 10);
const model = args.model || process.env.DEEPINFRA_MODEL || DEFAULT_DEEPINFRA_MODEL;
const plan = await loadOrCreatePlan(args);
const run = plan.runs.find((item) => item.prompt_id === promptId && item.condition === condition);
if (!run) throw new Error(`No benchmark run found for prompt_id=${promptId} condition=${condition}`);
await writeJson(path.join(outputRoot, "run-plan.json"), plan);

let currentHtmlPath = args.sourceHtml || path.join(sourceRoot, promptId, condition, "index.html");
let currentReviewPath = args.review || path.join(sourceRoot, promptId, condition, "review.json");
if (!existsSync(currentHtmlPath)) throw new Error(`Source HTML not found: ${currentHtmlPath}`);
if (!existsSync(currentReviewPath)) throw new Error(`UXRay review report not found: ${currentReviewPath}`);
let currentReview = await readJson(currentReviewPath);
let previousScore = Number(currentReview.score ?? 0);
const iterations = [];
let finalDecision = { stop: false, reason: "not_started" };

for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
  const sourceHtml = await readFile(currentHtmlPath, "utf8");
  const iterationRepairMode = repairModeForIteration({ iteration, previousReview: currentReview, defaultMode: repairMode });
  const repairRun = buildRepairRun({
    run,
    sourceHtml,
    review: currentReview,
    issueLimit: Number.parseInt(args.issueLimit || "6", 10),
    repairMode: iterationRepairMode
  });
  console.log(`[auto-repair] iteration ${iteration}/${maxIterations}: source_score=${currentReview.score} mode=${iterationRepairMode}`);
  const repairedHtml = await generateHtmlWithDeepInfra(repairRun, {
    apiKey: args.apiKey || process.env.DEEPINFRA_API_KEY,
    model,
    temperature: args.temperature || 0.2,
    maxTokens: args.maxTokens || 9000
  });
  const iterationRoot = path.join(outputRoot, `iter-${iteration}`);
  const htmlPath = path.join(iterationRoot, promptId, condition, "index.html");
  await mkdir(path.dirname(htmlPath), { recursive: true });
  await writeFile(htmlPath, `${repairedHtml}\n`);
  await writeJson(path.join(path.dirname(htmlPath), "repair-generation.json"), {
    provider: "deepinfra",
    model,
    iteration,
    source_html_path: currentHtmlPath,
    source_review_path: currentReviewPath,
    source_score: currentReview.score,
    repair_mode: iterationRepairMode,
    run_id: repairRun.run_id,
    prompt_id: promptId,
    condition,
    html_path: htmlPath,
    generator_prompt: repairRun.generator_prompt,
    generated_at: new Date().toISOString()
  });
  const review = await reviewHtml({ run, outputRoot: iterationRoot, port });
  const counts = issueCount(review);
  const decision = repairLoopDecision({
    score: review.score,
    highIssues: counts.high_issue_count,
    previousScore,
    iteration,
    maxIterations,
    targetScore,
    allowStructuralRetry: repairMode === "auto" && iterationRepairMode === "conservative"
  });
  const reviewPath = path.join(iterationRoot, promptId, condition, "review.json");
  iterations.push({ iteration, repair_mode: iterationRepairMode, html_path: htmlPath, review_path: reviewPath, score: review.score, ...counts, decision });
  finalDecision = decision;
  currentHtmlPath = htmlPath;
  currentReviewPath = reviewPath;
  currentReview = review;
  previousScore = Number(review.score ?? 0);
  if (decision.stop) break;
}

const bestIteration = chooseBestRepairIteration(iterations);
const summary = {
  ok: true,
  provider: "deepinfra",
  model,
  prompt_id: promptId,
  condition,
  source_root: sourceRoot,
  output_root: outputRoot,
  max_iterations: maxIterations,
  target_score: targetScore,
  repair_mode: repairMode,
  iterations,
  best_iteration: bestIteration,
  final_decision: finalDecision,
  final_score: iterations.at(-1)?.score ?? Number(currentReview.score ?? 0),
  final_review_path: iterations.at(-1)?.review_path || currentReviewPath,
  final_html_path: iterations.at(-1)?.html_path || currentHtmlPath,
  best_score: bestIteration?.score ?? Number(currentReview.score ?? 0),
  best_review_path: bestIteration?.review_path || currentReviewPath,
  best_html_path: bestIteration?.html_path || currentHtmlPath
};
await writeJson(path.join(outputRoot, "auto-repair-summary.json"), summary);
console.log(JSON.stringify(summary, null, 2));
