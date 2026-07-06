import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const codexHome = process.env.CODEX_HOME ?? "/home/nxank4";
const repairPort = Number(process.env.REPAIR_FIXTURE_PORT ?? 5181);
const baselineFixturePort = process.env.BASELINE_FIXTURE_PORT ?? "5182";
const baselineApiPort = process.env.BASELINE_API_PORT ?? "4324";
const afterFixturePort = process.env.AFTER_FIXTURE_PORT ?? "5183";
const afterApiPort = process.env.AFTER_API_PORT ?? "4325";
const skipCodexRepair = process.env.SKIP_CODEX_REPAIR === "1";
const resetFixtures = process.env.RESET_FIXTURES !== "0";
const logDir = "reports/demo";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(" ")}`);
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
    });
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
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
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
  return `We are running the one-shot UI Reviewer MCP demo pipeline. Three flawed fixtures are served at: ${baseUrl}/landing-chaos/, ${baseUrl}/dashboard-density/, and ${baseUrl}/onboarding-form/. For each fixture, use the ui-reviewer MCP server to call review_ui_url with viewport desktop and mobile, strictness high, return_images true, use_vision false. Inspect the MCP-returned screenshots and structured issues. Then edit only the matching files under examples/eval-fixtures/*/index.html to repair the major issues. Requirements: landing has one primary CTA and no mobile overflow; dashboard has clear primary workflow, fewer nav/action choices, responsive table/cards, and no mobile overflow; onboarding has clear progress/state structure, one primary submit action, grouped fields, and no mobile overflow. Do not commit. After edits, report one bullet per fixture with the repair made.`;
}

await mkdir(logDir, { recursive: true });

if (resetFixtures) {
  await run("node", ["scripts/reset-eval-fixtures.mjs"]);
}

await run("npm", ["run", "typecheck"]);

await run("npm", ["run", "eval:fixtures"], {
  env: {
    OPENAI_API_KEY: "",
    EVAL_PHASE: "baseline",
    FIXTURE_PORT: baselineFixturePort,
    API_PORT: baselineApiPort
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
        env: {
          HOME: codexHome,
          OPENAI_API_KEY: ""
        }
      }
    );
    const logPath = `${logDir}/one-shot-codex-repair.log`;
    await writeFile(logPath, `${result.stdout}\n${result.stderr}`);
    codexResult = { skipped: false, log_path: logPath };
  } finally {
    fixtureServer.kill("SIGTERM");
  }
}

await run("npm", ["run", "eval:fixtures"], {
  env: {
    OPENAI_API_KEY: "",
    EVAL_PHASE: "after",
    FIXTURE_PORT: afterFixturePort,
    API_PORT: afterApiPort
  }
});

const report = await run("npm", ["run", "demo:report"], { capture: true });

await run("npm", ["run", "build"]);

console.log("\nONE_SHOT_DEMO_PIPELINE_RESULT");
console.log(JSON.stringify({
  status: "completed",
  reset_fixtures: resetFixtures,
  codex_repair: codexResult,
  report_command_output: report.stdout.trim().slice(-1200)
}, null, 2));
