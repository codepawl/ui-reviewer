#!/usr/bin/env node
import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { buildBenchmarkRunPlan, readJson, summarizeBenchmarkReports, writeJson } from "./lib/taste-benchmark.mjs";
import { materializeBenchmarkFixtures, reviewCommandForRun } from "./lib/taste-benchmark-runner.mjs";

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

async function loadOrCreatePlan(args) {
  if (args.plan && existsSync(args.plan)) return readJson(args.plan);
  const prompts = await readJson(args.prompts || "data/benchmarks/taste-loop-prompts.json");
  const tasteProfiles = await readJson(args.profiles || "data/annotations/taste-profiles.json");
  return buildBenchmarkRunPlan({ prompts, profile: args.profile || "technical_premium", baseProfile: args.baseProfile || "balanced", tasteProfiles });
}

const args = parseArgs(process.argv.slice(2));
const outputRoot = args.outputRoot || "reports/taste-benchmark";
const port = Number.parseInt(args.port || "43210", 10);
const planOut = args.planOut || path.join(outputRoot, "run-plan.json");
const summaryOut = args.summaryOut || path.join(outputRoot, "summary.json");
const plan = await loadOrCreatePlan(args);
await writeJson(planOut, plan);
const materialized = (args.materialize === "0" || args.materialize === "false")
  ? []
  : await materializeBenchmarkFixtures(plan, { outputRoot, onlyCondition: args.condition });

let reviewed = [];
if (args.review === "1" || args.review === "true") {
  const server = await startStaticServer(outputRoot, port);
  try {
    const candidates = plan.runs
      .filter((run) => !args.condition || run.condition === args.condition)
      .slice(0, Number.parseInt(args.limit || String(plan.runs.length), 10));
    for (const run of candidates) {
      console.log(`\n[taste-benchmark] reviewing ${run.run_id}`);
      const spec = reviewCommandForRun(run, { port, rootDir: outputRoot });
      await mkdir(spec.env.REVIEW_OUTPUT_DIR, { recursive: true });
      const result = await runCommand(spec.command, spec.env);
      reviewed.push({ run_id: run.run_id, exit_code: result.exit_code, report_path: path.join(spec.env.REVIEW_OUTPUT_DIR, "review.json") });
      if (result.exit_code !== 0 && args.keepGoing !== "1" && args.keepGoing !== "true") break;
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

let summary = null;
if (reviewed.length > 0) {
  const reportItems = [];
  for (const item of reviewed) {
    if (!existsSync(item.report_path)) continue;
    const [prompt_id, condition] = item.run_id.split("__");
    reportItems.push({ prompt_id, condition, report_path: item.report_path, report: JSON.parse(await readFile(item.report_path, "utf8")) });
  }
  summary = summarizeBenchmarkReports(reportItems);
  await writeJson(summaryOut, summary);
}

console.log(JSON.stringify({
  ok: true,
  plan_path: planOut,
  output_root: outputRoot,
  materialized: materialized.length,
  reviewed,
  summary_path: summary ? summaryOut : null,
  summary
}, null, 2));
