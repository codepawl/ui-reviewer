import { spawn } from "node:child_process";
import net from "node:net";
import { mkdir, writeFile } from "node:fs/promises";

const codexHome = process.env.CODEX_HOME ?? "/home/nxank4";
const skipCodexRepair = process.env.SKIP_CODEX_REPAIR === "1";
const resetFixtures = process.env.RESET_FIXTURES !== "0";
const codexRepairTimeoutMs = Number(process.env.CODEX_REPAIR_TIMEOUT_MS ?? 10 * 60 * 1000);
const logDir = "reports/demo";

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error("Could not allocate a free local port"));
      });
    });
  });
}

function withTimeout(child, timeoutMs, label) {
  if (!timeoutMs || timeoutMs <= 0) return null;
  return setTimeout(() => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    console.error(`\n${label} exceeded ${timeoutMs}ms; terminating process ${child.pid}`);
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, 5_000).unref();
  }, timeoutMs);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(" ")}`);
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
    });
    const timer = withTimeout(child, options.timeoutMs, `${command} ${args.join(" ")}`);
    let stdout = "";
    let stderr = "";
    if (options.capture) {
      child.stdout.on("data", (data) => {
        stdout += data;
        process.stdout.write(data);
      });
      child.stderr.on("data", (data) => {
        stderr += data;
        process.stderr.write(data);
      });
    }
    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? signal}`));
    });
  });
}

function startProcess(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (data) => process.stdout.write(data));
  child.stderr.on("data", (data) => process.stderr.write(data));
  return child;
}

function stopProcess(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return resolve();
    const force = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, 3_000);
    child.once("exit", () => {
      clearTimeout(force);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function waitFor(url) {
  let lastError;
  for (let index = 0; index < 40; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError;
}

function repairPrompt(baseUrl) {
  return `We are running the one-shot UXRay MCP demo pipeline. Three flawed fixtures are served at: ${baseUrl}/landing-chaos/, ${baseUrl}/dashboard-density/, and ${baseUrl}/onboarding-form/. For each fixture, use the uxray MCP server to call review_ui_url with viewport desktop and mobile, strictness high, return_images true, use_vision false. Inspect the MCP-returned screenshots and structured issues. Then edit only the matching files under examples/eval-fixtures/*/index.html to repair the major issues. Requirements: landing has one primary CTA and no mobile overflow; dashboard has clear primary workflow, fewer nav/action choices, responsive table/cards, and no mobile overflow; onboarding has clear progress/state structure, one primary submit action, grouped fields, and no mobile overflow. Do not commit. After edits, report one bullet per fixture with the repair made.`;
}

await mkdir(logDir, { recursive: true });

const baselineFixturePort = Number(process.env.BASELINE_FIXTURE_PORT ?? await getFreePort());
const baselineApiPort = Number(process.env.BASELINE_API_PORT ?? await getFreePort());
const repairPort = Number(process.env.REPAIR_FIXTURE_PORT ?? await getFreePort());
const afterFixturePort = Number(process.env.AFTER_FIXTURE_PORT ?? await getFreePort());
const afterApiPort = Number(process.env.AFTER_API_PORT ?? await getFreePort());

if (resetFixtures) {
  await run("node", ["scripts/reset-eval-fixtures.mjs"]);
}

await run("npm", ["run", "typecheck"]);

await run("npm", ["run", "eval:fixtures"], {
  env: {
    OPENAI_API_KEY: "",
    EVAL_PHASE: "baseline",
    FIXTURE_PORT: String(baselineFixturePort),
    API_PORT: String(baselineApiPort)
  }
});

let codexResult = { skipped: skipCodexRepair };
if (!skipCodexRepair) {
  const fixtureServer = startProcess("python3", ["-m", "http.server", String(repairPort), "--bind", "127.0.0.1", "--directory", "examples/eval-fixtures"]);
  try {
    await waitFor(`http://127.0.0.1:${repairPort}/landing-chaos/`);
    const result = await run(
      "codex",
      [
        "exec",
        "--sandbox",
        "workspace-write",
        "--cd",
        process.cwd(),
        repairPrompt(`http://127.0.0.1:${repairPort}`)
      ],
      {
        capture: true,
        timeoutMs: codexRepairTimeoutMs,
        env: {
          HOME: codexHome,
          OPENAI_API_KEY: ""
        }
      }
    );
    const logPath = `${logDir}/one-shot-codex-repair.log`;
    await writeFile(logPath, `${result.stdout}\n${result.stderr}`);
    codexResult = { skipped: false, log_path: logPath, timeout_ms: codexRepairTimeoutMs };
  } finally {
    await stopProcess(fixtureServer);
  }
}

await run("npm", ["run", "eval:fixtures"], {
  env: {
    OPENAI_API_KEY: "",
    EVAL_PHASE: "after",
    FIXTURE_PORT: String(afterFixturePort),
    API_PORT: String(afterApiPort)
  }
});

const report = await run("npm", ["run", "demo:report"], { capture: true });

await run("npm", ["run", "build"]);

console.log("\nONE_SHOT_DEMO_PIPELINE_RESULT");
console.log(JSON.stringify({
  status: "completed",
  reset_fixtures: resetFixtures,
  ports: {
    baseline_fixture: baselineFixturePort,
    baseline_api: baselineApiPort,
    repair_fixture: repairPort,
    after_fixture: afterFixturePort,
    after_api: afterApiPort
  },
  codex_repair: codexResult,
  report_command_output: report.stdout.trim().slice(-1200)
}, null, 2));
