import { mkdir, readFile, writeFile } from "node:fs/promises";

const baselinePath = process.env.BASELINE_SUMMARY ?? "reports/evals/spike-007/baseline-summary.json";
const afterPath = process.env.AFTER_SUMMARY ?? "reports/evals/spike-007/after-summary.json";
const outDir = process.env.DEMO_REPORT_DIR ?? "reports/demo";

function titleCase(value) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function categoryLabel(value) {
  return value.replaceAll("_", " ");
}

function fixtureRow(baseline, after, diff) {
  const fixed = diff.fixed_issue_categories.map(categoryLabel).join(", ") || "none";
  return `| ${titleCase(baseline.id)} | ${baseline.score} → ${after.score} | ${baseline.issue_count} → ${after.issue_count} | ${baseline.high_severity_issues} → ${after.high_severity_issues} | ${fixed} |`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  let inCode = false;
  let inList = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        html.push("</code></pre>");
        inCode = false;
      } else {
        html.push("<pre><code>");
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      html.push(escapeHtml(line));
      continue;
    }

    if (line.startsWith("# ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith("- ")) {
      if (!inList) { html.push("<ul>"); inList = true; }
      html.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else if (line.startsWith("| ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      if (line.includes("---")) continue;
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      const tag = html.at(-1)?.endsWith("</tr></table>") ? "td" : "th";
      const row = `<tr>${cells.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join("")}</tr>`;
      if (tag === "th") html.push(`<table>${row}</table>`);
      else html[html.length - 1] = html[html.length - 1].replace("</table>", `${row}</table>`);
    } else if (line.trim()) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<p>${escapeHtml(line)}</p>`);
    }
  }

  if (inList) html.push("</ul>");
  return html.join("\n");
}

const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const after = JSON.parse(await readFile(afterPath, "utf8"));
const diffById = new Map(after.diffs.map((diff) => [diff.label.replace(/-after$/, ""), diff]));
const afterById = new Map(after.fixtures.map((fixture) => [fixture.id, fixture]));

const scoreDelta = after.average_score - baseline.average_score;
const issueDelta = after.total_issues - baseline.total_issues;
const highDelta = after.high_severity_issues - baseline.high_severity_issues;
const improvedCount = after.diffs.filter((diff) => diff.verdict === "improved").length;
const allFixedCategories = [...new Set(after.diffs.flatMap((diff) => diff.fixed_issue_categories))].sort();

const rows = baseline.fixtures.map((fixture) => fixtureRow(fixture, afterById.get(fixture.id), diffById.get(fixture.id)));

const markdown = `# UXRay MCP Demo Report

## One-line result

UXRay found major UX/layout failures in three AI-generated frontend fixtures, Codex repaired them using MCP screenshots and structured issues, and the eval score improved from ${baseline.average_score} to ${after.average_score}.

## Why this matters

AI-generated UIs often look polished while still failing at hierarchy, primary task clarity, mobile layout, and form state design. This demo shows a measurable review-and-repair loop instead of generic design advice.

## Product loop

\`\`\`txt
MCP/API review -> screenshot-aware Codex repair -> rerun eval -> diff scorecard
\`\`\`

## Aggregate scorecard

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Average score | ${baseline.average_score} | ${after.average_score} | +${scoreDelta} |
| Total issues | ${baseline.total_issues} | ${after.total_issues} | ${issueDelta} |
| High-severity issues | ${baseline.high_severity_issues} | ${after.high_severity_issues} | ${highDelta} |
| Fixtures improved | 0/${baseline.fixture_count} | ${improvedCount}/${after.fixture_count} | +${improvedCount} |

## Per-fixture results

| Fixture | Score | Issues | High severity | Fixed categories |
| --- | ---: | ---: | ---: | --- |
${rows.join("\n")}

## Failure modes covered

- Landing page: vague value prop, competing CTAs, weak hierarchy, mobile overflow.
- Dashboard: dense navigation/actions, unclear primary workflow, table/card responsive failure.
- Onboarding/form: dumped fields, unclear progress/state, competing actions, fixed-width mobile layout.

## Categories fixed

${allFixedCategories.map((category) => `- ${categoryLabel(category)}`).join("\n")}

## Demo positioning

This is not just a screenshot critique tool. The wedge is a local MCP/API review layer that coding agents can call while building frontend code, then use as repair instructions and measurable quality gates.

## Current product surfaces

- MCP: \`review_ui_url\`, \`review_ui_diff\`, \`health_check\`
- API: \`POST /v1/reviews/url\`, \`POST /v1/reviews/diff\`, \`GET /health\`
- Eval: \`npm run eval:fixtures\`

## Evidence files

- Baseline summary: \`${baselinePath}\`
- After summary: \`${afterPath}\`
- Spike notes: \`spikes/007-fixture-pack/README.md\`
`;

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>UXRay MCP Demo Report</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #09090b; color: #f4f4f5; line-height: 1.6; }
      main { max-width: 980px; margin: 0 auto; padding: 48px 24px; }
      h1 { font-size: clamp(36px, 7vw, 72px); line-height: 1; letter-spacing: -0.05em; margin: 0 0 20px; }
      h2 { margin-top: 40px; color: #e4e4e7; }
      p, li { color: #cbd5e1; }
      pre, table { background: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; }
      pre { padding: 18px; overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 12px 14px; border-bottom: 1px solid #27272a; text-align: left; }
      th { color: #fafafa; background: #27272a; }
      tr:last-child td { border-bottom: 0; }
      .hero { padding: 28px; border: 1px solid #27272a; border-radius: 24px; background: radial-gradient(circle at top left, rgba(56,189,248,.18), transparent 38%), #111113; }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        ${markdownToHtml(markdown)}
      </section>
    </main>
  </body>
</html>
`;

await mkdir(outDir, { recursive: true });
const markdownPath = `${outDir}/spike-007-report.md`;
const htmlPath = `${outDir}/spike-007-report.html`;
await writeFile(markdownPath, markdown);
await writeFile(htmlPath, html);

console.log(JSON.stringify({
  markdown_path: markdownPath,
  html_path: htmlPath,
  average_score_before: baseline.average_score,
  average_score_after: after.average_score,
  score_delta: scoreDelta,
  total_issues_before: baseline.total_issues,
  total_issues_after: after.total_issues,
  high_severity_before: baseline.high_severity_issues,
  high_severity_after: after.high_severity_issues,
  fixtures_improved: `${improvedCount}/${after.fixture_count}`
}, null, 2));
