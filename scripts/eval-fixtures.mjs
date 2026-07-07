import { mkdir, writeFile, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";

const phase = process.env.EVAL_PHASE ?? "baseline";
const outDir = "reports/evals/spike-007";

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

const fixturePort = Number(process.env.FIXTURE_PORT ?? await getFreePort());
const apiPort = Number(process.env.API_PORT ?? await getFreePort());
const fixtureBase = `http://127.0.0.1:${fixturePort}`;
const apiBase = `http://127.0.0.1:${apiPort}`;

const fixtures = [
  {
    id: "landing-chaos",
    goal: "Landing page for UXRay, an MCP UI review tool that helps coding agents fix AI-generated frontend UX problems",
    audience: "technical founders and developers choosing tools for AI-generated frontend repair"
  },
  {
    id: "dashboard-density",
    goal: "Operations dashboard that helps a founder identify the highest-priority customer or revenue risk in under one minute",
    audience: "startup founders and customer success operators reviewing growth and billing health"
  },
  {
    id: "onboarding-form",
    goal: "Onboarding flow that helps a technical team connect a repo and configure UI review without confusion or abandoned setup",
    audience: "developers and founders setting up UXRay for the first time"
  }
];

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

async function postJson(path, body) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const fixtureServer = startProcess("python3", ["-m", "http.server", String(fixturePort), "--bind", "127.0.0.1", "--directory", "examples/eval-fixtures"]);
const apiServer = startProcess("./node_modules/.bin/tsx", ["apps/api/src/index.ts"], { PORT: String(apiPort) });

try {
  await waitFor(`${fixtureBase}/landing-chaos/`);
  await waitFor(`${apiBase}/health`);
  await mkdir(outDir, { recursive: true });

  const reviews = [];
  for (const fixture of fixtures) {
    const report = await postJson("/v1/reviews/url", {
      url: `${fixtureBase}/${fixture.id}/`,
      goal: fixture.goal,
      audience: fixture.audience,
      viewport: ["desktop", "mobile"],
      strictness: "high"
    });
    const reportPath = `${outDir}/${phase}-${fixture.id}.json`;
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    reviews.push({ fixture, report, reportPath });
  }

  const summary = {
    phase,
    product_stage: "spike-007-fixture-pack",
    fixture_count: reviews.length,
    average_score: Math.round(reviews.reduce((sum, item) => sum + item.report.score, 0) / reviews.length),
    total_issues: reviews.reduce((sum, item) => sum + item.report.top_issues.length, 0),
    high_severity_issues: reviews.reduce((sum, item) => sum + item.report.top_issues.filter((issue) => issue.severity === "high").length, 0),
    fixtures: reviews.map(({ fixture, report, reportPath }) => ({
      id: fixture.id,
      url: `${fixtureBase}/${fixture.id}/`,
      score: report.score,
      verdict: report.verdict,
      issue_count: report.top_issues.length,
      high_severity_issues: report.top_issues.filter((issue) => issue.severity === "high").length,
      categories: [...new Set(report.top_issues.map((issue) => issue.category))],
      report_path: reportPath
    }))
  };

  if (phase !== "baseline") {
    const diffs = [];
    for (const { fixture, report } of reviews) {
      const before = await readJson(`${outDir}/baseline-${fixture.id}.json`);
      diffs.push(
        await postJson("/v1/reviews/diff", {
          label: `${fixture.id}-${phase}`,
          before,
          after: report
        })
      );
    }
    summary.diffs = diffs.map((diff) => ({
      label: diff.label,
      verdict: diff.verdict,
      score_delta: diff.score_delta,
      issue_count_delta: diff.issue_count_delta,
      high_severity_delta: diff.high_severity_delta,
      fixed_issue_categories: diff.fixed_issue_categories,
      introduced_issue_categories: diff.introduced_issue_categories,
      codex_next_action: diff.codex_next_action
    }));
  }

  const summaryPath = `${outDir}/${phase}-summary.json`;
  await writeFile(summaryPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await Promise.all([stopProcess(fixtureServer), stopProcess(apiServer)]);
}
