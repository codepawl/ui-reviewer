import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const BENCHMARK_PLAN_SCHEMA_VERSION = "uxray.taste_benchmark_plan.v1";
export const BENCHMARK_SUMMARY_SCHEMA_VERSION = "uxray.taste_benchmark_summary.v1";
export const CONDITIONS = ["baseline", "taste_context", "uxray_repair"];

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function cleanList(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function tasteContextText(profileId, profile = {}) {
  const lines = [];
  lines.push(`Taste profile: ${profileId}`);
  if (profile.description) lines.push(`Description: ${profile.description}`);
  lines.push("Prefer:");
  for (const item of cleanList(profile.prefer)) lines.push(`- ${item}`);
  lines.push("Avoid:");
  for (const item of cleanList(profile.avoid)) lines.push(`- ${item}`);
  return lines.join("\n");
}

function promptBrief(prompt) {
  return [
    `Product goal: ${prompt.product_goal}`,
    `Audience: ${prompt.audience}`,
    `Primary user task: ${prompt.primary_task}`,
    `Route type: ${prompt.route_type}`,
    prompt.constraints?.length ? `Constraints: ${prompt.constraints.join("; ")}` : null,
    prompt.slop_risks?.length ? `Known AI-slop risks to avoid: ${prompt.slop_risks.join("; ")}` : null
  ].filter(Boolean).join("\n");
}

function uxrayHardConstraintsText() {
  return [
    "UXRay hard constraints:",
    "- Mobile must render without horizontal overflow at 390px width; use max-width: 100%, box-sizing: border-box, and wrapping layouts.",
    "- If the UI includes forms, expose helper text plus at least one validation, error, success, or recovery state in visible copy. Do not rely on placeholder text or hidden JavaScript for these states.",
    "- No heading level jumps; use a valid H1 → H2 → H3 document outline.",
    "- All interactive targets must be at least 44×44 CSS pixels on mobile and desktop.",
    "- Peer cards must use equal-height, balanced-density layouts; avoid one oversized card beside thin filler cards.",
    "- Text and action contrast must be at least 4.5:1; avoid low-contrast blue/gray button combinations.",
    "- H1 must be a descriptive outcome statement, not only a product name or category label.",
    "- Keep the primary action obvious and avoid competing above-fold CTAs.",
    "- No fake metrics, fake customer logos, or unverifiable benchmark claims.",
    "- Use concrete mechanism evidence over generic SaaS filler."
  ].join("\n");
}

function routeSpecificConstraintsText(routeType) {
  const packs = {
    app_shell: [
      "Route-specific constraints for app_shell:",
      "- Do not use a landing-page hero; render an app workspace with operator chrome, side rail, main conversation, and tool/progress panel.",
      "- Show visible tool progress, queued/running/done/error states, and repair evidence attached to the relevant agent step.",
      "- No more than 3 above-fold action buttons; group extra actions under a secondary details/logs area below the fold.",
      "- Provide one primary intervention affordance plus quiet secondary inspect/retry controls; avoid a static empty chat mock.",
      "- Avoid yellow, green, or red text-only action buttons; use high-contrast neutral buttons with status badges or icons separated from the clickable label.",
      "- Keep rows flexible without smooth-scroll gimmicks; prioritize state clarity over decorative motion."
    ],
    editorial_homepage: [
      "Route-specific constraints for editorial_homepage:",
      "- Prioritize story scanning above signup; the first viewport should show current stories, timestamps, source/context, and clear grouping.",
      "- Use editorial density intentionally; avoid luxury whitespace, generic RSS card soup, and repeated equal-weight story tiles.",
      "- Keep CTAs quiet and secondary; the primary task is opening a relevant story, not joining a waitlist.",
      "- Include recency/status affordances such as live, updated, developing, or source count without fake metrics."
    ],
    auth: [
      "Route-specific constraints for auth:",
      "- Show sent, expired, invalid email, and resend states as visible UI copy, not hidden placeholders.",
      "- H1 must describe the outcome, for example: 'Get a secure sign-in link and recover if it expires', not just 'Sign in' or 'Magic link'.",
      "- Keep one primary email action, one recovery path, and a quiet secondary sign-in/help link.",
      "- The primary button and recovery link must each be at least 44×44 CSS pixels on mobile.",
      "- Explain magic-link timing and what to do if the email does not arrive; avoid generic auth-card filler.",
      "- Do not dump raw JSON or technical errors to the user."
    ],
    docs: [
      "Route-specific constraints for docs:",
      "- Put the install command and first review command in copyable, spacious code blocks above the fold.",
      "- Use a docs layout with nav/contents and scannable sections; do not let marketing hero copy dominate.",
      "- Keep command text readable on mobile with wrapping or horizontal containment; avoid tight code-block spacing."
    ],
    report: [
      "Route-specific constraints for report:",
      "- Prioritize score, high-severity blockers, screenshots, and repair plan over decorative analytics cards.",
      "- Give screenshots enough room and connect each issue to evidence and a copyable repair prompt.",
      "- Keep blocker hierarchy obvious; do not give every card equal visual weight."
    ],
    builder: [
      "Route-specific constraints for builder:",
      "- Render a readable workflow canvas with clear selected step details, not a decorative node graph.",
      "- Controls for add/reorder/run must be at least 44×44 and visibly actionable.",
      "- Show pipeline status and resulting review/repair/verification steps with clear graph hierarchy."
    ],
    pricing: [
      "Route-specific constraints for pricing:",
      "- Plan cards must read as equal peers with comparable density and aligned CTAs.",
      "- Avoid fake urgency, fake usage stats, and excessive badges; keep local/free path credible.",
      "- Make the recommended plan distinct without making the other plans look broken or secondary-only."
    ],
    dashboard: [
      "Route-specific constraints for dashboard:",
      "- Empty state must look intentionally empty, with one setup action, one recovery path, and a visible pending/success/error state.",
      "- Avoid fake analytics before setup; use setup checklist/progress instead.",
      "- Keep dashboard chrome present so the screen does not feel like a landing page."
    ],
    landing: [
      "Route-specific constraints for landing:",
      "- Make the above-fold promise concrete and mechanism-led; avoid generic transformation claims.",
      "- Use one primary CTA and proof-by-workflow examples instead of fake metrics or logo strips."
    ]
  };
  const lines = packs[routeType] || [];
  return lines.length ? lines.join("\n") : null;
}

function generatorPromptFor({ prompt, condition, profileId, profile }) {
  const brief = promptBrief(prompt);
  const routeConstraints = routeSpecificConstraintsText(prompt.route_type);
  if (condition === "baseline") {
    return [
      "Generate a polished, production-ready UI for this product brief.",
      brief,
      "Return a complete responsive HTML/CSS implementation."
    ].join("\n\n");
  }
  if (condition === "taste_context") {
    return [
      "Generate a responsive UI that follows the product brief and the taste context. Create an intentional design strategy rather than generic SaaS polish.",
      brief,
      tasteContextText(profileId, profile),
      uxrayHardConstraintsText(),
      routeConstraints,
      "Return a complete responsive HTML/CSS implementation."
    ].filter(Boolean).join("\n\n");
  }
  return [
    "Run UXRay mentally on the generated UI, repair hard issues, then preserve the taste context while removing AI-slop. Do not add decorative complexity to hide layout problems.",
    "Generate the post-repair HTML directly; do not describe the review process and do not claim you ran external tools.",
    brief,
    tasteContextText(profileId, profile),
    uxrayHardConstraintsText(),
    routeConstraints,
    "Required loop: render desktop/mobile, run review:url, fix high-severity issues, rerun review:url, report score/high-severity delta."
  ].filter(Boolean).join("\n\n");
}

export function normalizeBenchmarkPrompts(prompts) {
  return prompts.map((prompt, index) => ({
    id: prompt.id || `prompt_${String(index + 1).padStart(2, "0")}`,
    route_type: prompt.route_type || "landing",
    product_goal: prompt.product_goal,
    audience: prompt.audience,
    primary_task: prompt.primary_task,
    constraints: cleanList(prompt.constraints),
    slop_risks: cleanList(prompt.slop_risks),
    success_metrics: cleanList(prompt.success_metrics)
  }));
}

export function buildBenchmarkRunPlan({ prompts, profile = "technical_premium", baseProfile = "balanced", tasteProfiles = {} }) {
  const normalizedPrompts = normalizeBenchmarkPrompts(prompts);
  const profileDefinition = tasteProfiles[profile] || { base_profile: baseProfile };
  const runs = normalizedPrompts.flatMap((prompt) => CONDITIONS.map((condition) => ({
    run_id: `${prompt.id}__${condition}`,
    prompt_id: prompt.id,
    condition,
    route_type: prompt.route_type,
    review_taste_profile: profileDefinition.base_profile || baseProfile,
    target_taste_profile: profile,
    generator_prompt: generatorPromptFor({ prompt, condition, profileId: profile, profile: profileDefinition }),
    expected_artifacts: {
      html_path: `reports/taste-benchmark/${prompt.id}/${condition}/index.html`,
      review_report_path: `reports/taste-benchmark/${prompt.id}/${condition}/review.json`,
      screenshots_dir: `reports/taste-benchmark/${prompt.id}/${condition}/screenshots`
    }
  })));
  return {
    schema_version: BENCHMARK_PLAN_SCHEMA_VERSION,
    profile,
    base_profile: profileDefinition.base_profile || baseProfile,
    conditions: CONDITIONS,
    prompts: normalizedPrompts,
    runs,
    measurement: {
      primary: ["human_pairwise_win_rate", "avg_high_issue_delta_vs_baseline", "avg_score_delta_vs_baseline"],
      hard_metrics: ["score", "issue_count", "high_issue_count", "top_issue_categories"],
      human_axes: ["ai_slop", "scanability", "copy_specificity", "brand_fit", "creative_distinctiveness"]
    }
  };
}

function issueStats(report = {}) {
  const issues = Array.isArray(report.top_issues) ? report.top_issues : [];
  return {
    score: Number(report.score ?? 0),
    issue_count: issues.length,
    high_issue_count: issues.filter((issue) => issue.severity === "high").length,
    categories: Array.from(new Set(issues.map((issue) => issue.category).filter(Boolean)))
  };
}

function avg(items) {
  if (!items.length) return 0;
  return Number((items.reduce((sum, value) => sum + value, 0) / items.length).toFixed(2));
}

export function summarizeBenchmarkReports(items) {
  const byCondition = new Map();
  const baselineByPrompt = new Map();
  for (const item of items) {
    const stats = issueStats(item.report);
    const row = { ...item, stats };
    if (!byCondition.has(item.condition)) byCondition.set(item.condition, []);
    byCondition.get(item.condition).push(row);
    if (item.condition === "baseline") baselineByPrompt.set(item.prompt_id, stats);
  }
  const conditions = {};
  for (const condition of Array.from(byCondition.keys()).sort()) {
    const rows = byCondition.get(condition);
    const scoreDeltas = rows
      .filter((row) => baselineByPrompt.has(row.prompt_id))
      .map((row) => row.stats.score - baselineByPrompt.get(row.prompt_id).score);
    const highDeltas = rows
      .filter((row) => baselineByPrompt.has(row.prompt_id))
      .map((row) => row.stats.high_issue_count - baselineByPrompt.get(row.prompt_id).high_issue_count);
    conditions[condition] = {
      n: rows.length,
      avg_score: avg(rows.map((row) => row.stats.score)),
      avg_issue_count: avg(rows.map((row) => row.stats.issue_count)),
      avg_high_issues: avg(rows.map((row) => row.stats.high_issue_count)),
      avg_score_delta_vs_baseline: avg(scoreDeltas),
      avg_high_issue_delta_vs_baseline: avg(highDeltas)
    };
  }
  return {
    schema_version: BENCHMARK_SUMMARY_SCHEMA_VERSION,
    evaluated_runs: items.length,
    conditions
  };
}
