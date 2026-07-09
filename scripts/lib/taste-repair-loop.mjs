function cleanText(value, max = 900) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function severityRank(severity) {
  return severity === "high" ? 0 : severity === "medium" ? 1 : severity === "low" ? 2 : 3;
}

export function compactReviewIssues(review = {}, { limit = 6 } = {}) {
  const issues = Array.isArray(review.top_issues) ? review.top_issues : [];
  return issues
    .slice()
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, limit)
    .map((issue) => ({
      severity: issue.severity || "unknown",
      category: issue.category || "unknown",
      affected_area: issue.affected_area || "unspecified",
      evidence: cleanText(issue.evidence || issue.message || issue.issue, 700),
      fix: cleanText(issue.fix || issue.recommendation || issue.repair_guidance, 700)
    }));
}

function issueLines(issues) {
  if (!issues.length) return "- UXRay reported no top issues; preserve the current strengths and only make safe polish changes.";
  return issues.map((issue, index) => [
    `${index + 1}. [${issue.severity}] ${issue.category} — ${issue.affected_area}`,
    `   Evidence: ${issue.evidence || "not provided"}`,
    `   Required fix: ${issue.fix || "repair the issue without weakening task fit"}`
  ].join("\n")).join("\n");
}

function targetedRepairDirectives(issues, routeType, repairMode = "conservative") {
  const categories = new Set(issues.map((issue) => issue.category));
  const lines = ["Targeted repair directives:"];
  if (categories.has("accessibility")) {
    lines.push("- For accessibility contrast issues: replace low-contrast yellow, green, red, or pale accent buttons with neutral high-contrast treatments such as white text on #111827 or #1d4ed8, or #0f172a text on white with a visible border.");
  }
  if (categories.has("task_flow") || routeType === "app_shell") {
    lines.push("- For action-density issues: keep at most one primary action and no more than 3 above-fold action buttons; move retry/log/settings/destructive controls into a below-fold details panel or menu.");
  }
  if (categories.has("content_density")) {
    lines.push("- For content-density issues: add at least two visible H2 or H3 labels to the dense app areas, split long panels into scannable groups, reduce crowded above-fold clusters, and move secondary prose below the first viewport if needed.");
  }
  if (categories.has("state_completeness")) {
    lines.push("- For state-completeness issues: show visible helper, loading, success, error, and recovery copy near the relevant input or workflow step.");
  }
  if (categories.has("visual_hierarchy")) {
    lines.push("- For visual-hierarchy issues: increase the primary H1 visual weight, reduce competing chrome, and use one subtle secondary type treatment for metadata.");
  }
  if (repairMode === "structural") {
    lines.push("- Structural repair mode: rewrite the layout structure when conservative patching cannot remove density/crowding. Preserve the task, but you may change grid columns, move secondary panels below the fold, collapse tertiary controls into menus, and simplify decorative containers.");
    lines.push("- Structural acceptance target: reduce above-fold crowded regions, keep no more than 3 above-fold actions, add clear section labels, and prefer fewer larger task zones over many small cards.");
  }
  return lines.length > 1 ? lines.join("\n") : null;
}

export function buildRepairRun({ run, sourceHtml, review, issueLimit = 6, repairMode = "conservative" }) {
  if (!run) throw new Error("run is required to build an actual repair-loop prompt.");
  if (!sourceHtml) throw new Error("sourceHtml is required to build an actual repair-loop prompt.");
  if (!review) throw new Error("review is required to build an actual repair-loop prompt.");
  const issues = compactReviewIssues(review, { limit: issueLimit });
  const directives = targetedRepairDirectives(issues, run.route_type, repairMode);
  const prompt = [
    "Actual UXRay repair loop: repair this already-rendered HTML using the real UXRay report below.",
    "Return only one complete corrected HTML document. Do not include Markdown, commentary, external assets, scripts, analytics, CDNs, or claims that you ran tools.",
    "Keep the same product task, route type, information architecture intent, and taste profile. Make the smallest visual/code changes that remove the reported issues.",
    "Do not introduce new UXRay blockers: preserve mobile no-overflow, valid H1/H2/H3 outline, 44×44 controls, contrast >= 4.5:1, one clear primary task, and route-specific behavior.",
    `Run id: ${run.run_id}`,
    `Route type: ${run.route_type}`,
    `Repair mode: ${repairMode}`,
    `Original UXRay score: ${Number(review.score ?? 0)}`,
    `Original verdict: ${cleanText(review.verdict || "unknown", 300)}`,
    "Original generation contract and route constraints:",
    run.generator_prompt,
    "UXRay issues to fix, in priority order:",
    issueLines(issues),
    directives,
    "Source HTML to repair:",
    sourceHtml
  ].filter(Boolean).join("\n\n");
  return {
    ...run,
    run_id: `${run.run_id}__actual_repair`,
    condition: `${run.condition}_actual_repair`,
    generator_prompt: prompt,
    repair_source: {
      source_run_id: run.run_id,
      source_score: Number(review.score ?? 0),
      issue_count: issues.length,
      repair_mode: repairMode
    }
  };
}

export function repairModeForIteration({ iteration, previousReview, defaultMode = "conservative" }) {
  if (defaultMode === "structural") return "structural";
  if (defaultMode !== "auto") return "conservative";
  if (Number(iteration) <= 1) return "conservative";
  const issues = Array.isArray(previousReview?.top_issues) ? previousReview.top_issues : [];
  const hasHigh = issues.some((issue) => issue.severity === "high");
  const categories = new Set(issues.map((issue) => issue.category));
  if (!hasHigh && (categories.has("content_density") || categories.has("visual_hierarchy") || categories.has("task_flow"))) {
    return "structural";
  }
  return "conservative";
}

export function repairLoopDecision({ score, highIssues, previousScore, iteration, maxIterations, targetScore, allowStructuralRetry = false }) {
  if (Number(score) >= Number(targetScore) && Number(highIssues) === 0) {
    return { stop: true, reason: "target_score_reached" };
  }
  if (Number(iteration) >= Number(maxIterations)) {
    return { stop: true, reason: "max_iterations_reached" };
  }
  if (Number(score) <= Number(previousScore)) {
    if (allowStructuralRetry && Number(iteration) < Number(maxIterations)) {
      return { stop: false, reason: "continue: escalate to structural repair" };
    }
    return { stop: true, reason: "no_score_improvement" };
  }
  return { stop: false, reason: "continue: score improved and target not reached" };
}

export function chooseBestRepairIteration(iterations = []) {
  return iterations.slice().sort((a, b) => {
    const highDelta = Number(a.high_issue_count ?? 0) - Number(b.high_issue_count ?? 0);
    if (highDelta !== 0) return highDelta;
    return Number(b.score ?? 0) - Number(a.score ?? 0);
  })[0] || null;
}
