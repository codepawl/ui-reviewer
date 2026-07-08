#!/usr/bin/env node
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const realHome = process.env.UXRAY_REAL_HOME || "/home/nxank4";
const fixturePort = Number(process.env.FIXTURE_PORT || 4271);
const fixtureUrl = `http://127.0.0.1:${fixturePort}`;
const fixtureDir = path.join(repoRoot, "examples", "eval-fixtures-seed", "landing-chaos");

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      env: { ...process.env, ...(options.env || {}) },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      stdout += `\n[uxray-smoke-timeout ${options.timeoutMs || 180_000}ms]\n`;
      child.kill("SIGTERM");
    }, options.timeoutMs || 180_000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ command: [command, ...args].join(" "), code, stdout, stderr });
    });
  });
}

async function waitForFixture() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(fixtureUrl);
      if (response.ok) return;
    } catch {
      // retry
    }
    await delay(250);
  }
  throw new Error(`fixture did not become ready at ${fixtureUrl}`);
}

function summarize(name, result, patterns) {
  const combined = `${result.stdout}\n${result.stderr}`;
  const summary = { name, exit_code: result.code };
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = combined.match(pattern);
    summary[key] = match ? (match[1] || true) : false;
  }
  summary.pass = Object.entries(patterns).every(([, pattern]) => pattern.test(combined));
  return summary;
}

const server = spawn("python3", ["-m", "http.server", String(fixturePort), "--bind", "127.0.0.1", "--directory", fixtureDir], {
  cwd: repoRoot,
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForFixture();
  console.error(`[uxray-smoke] fixture ready at ${fixtureUrl}`);

  console.error("[uxray-smoke] direct MCP smoke...");
  const direct = await run("npm", ["run", "smoke:mcp"], { timeoutMs: 180_000 });

  const codexPrompt = `SMOKE TEST ONLY. Do not edit files. Use the uxray MCP server. First call health_check. Then call review_ui_url on ${fixtureUrl} with viewports ['desktop','mobile'], strictness 'high', use_vision false, return_images false. In your final answer, include exactly these fields: UXRAY_HEALTH_CALLED yes/no, UXRAY_REVIEW_CALLED yes/no, SCORE, ISSUE_COUNT, TOP_CATEGORY. If you cannot call the tool, say why.`;
  console.error("[uxray-smoke] Codex MCP smoke...");
  const codex = await run("codex", ["exec", "--ephemeral", "--sandbox", "read-only", "--cd", repoRoot, "-c", "model_reasoning_effort=low", codexPrompt], {
    env: { HOME: realHome },
    timeoutMs: 240_000
  });

  const ompPrompt = `SMOKE TEST ONLY. Do not edit files. If UXRay MCP tools are available, call mcp__uxray_health_check, then call mcp__uxray_review_ui_url on ${fixtureUrl} with viewports desktop,mobile, strictness high, use_vision false, return_images false. Final answer only: OMP_UXRAY_HEALTH_CALLED yes/no; OMP_UXRAY_REVIEW_CALLED yes/no; SCORE; ISSUE_COUNT; TOP_CATEGORY; reason if no.`;
  console.error("[uxray-smoke] OMP MCP smoke...");
  const omp = await run("/home/nxank4/.bun/bin/omp", ["-p", "--no-session", "--max-time", "180", "--cwd", repoRoot, "--approval-mode", "yolo", ompPrompt], {
    env: { HOME: realHome },
    timeoutMs: 240_000
  });

  const output = {
    fixture_url: fixtureUrl,
    direct: summarize("direct", direct, {
      health_tool: /TOOLS .*health_check/s,
      review_tool: /TOOLS .*review_ui_url/s
    }),
    codex: summarize("codex", codex, {
      health_called: /UXRAY_HEALTH_CALLED\s+yes/i,
      review_called: /UXRAY_REVIEW_CALLED\s+yes/i,
      score: /SCORE\s+(\d+)/i,
      issue_count: /ISSUE_COUNT\s+(\d+)/i,
      top_category: /TOP_CATEGORY\s+([a-z_]+)/i
    }),
    omp: summarize("omp", omp, {
      health_called: /OMP_UXRAY_HEALTH_CALLED\s+yes/i,
      review_called: /OMP_UXRAY_REVIEW_CALLED\s+yes/i,
      score: /SCORE\s+(\d+)/i,
      issue_count: /ISSUE_COUNT\s+(\d+)/i,
      top_category: /TOP_CATEGORY\s+([a-z_]+)/i
    })
  };
  output.pass = output.direct.pass && output.codex.pass && output.omp.pass;
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = output.pass ? 0 : 1;
} finally {
  server.kill("SIGTERM");
  await Promise.race([once(server, "close"), delay(1200)]).catch(() => undefined);
}
