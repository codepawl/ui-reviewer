export type ReviewSeverity = "low" | "medium" | "high";

export type ReviewIssue = {
  severity: ReviewSeverity;
  category:
    | "intent_fit"
    | "information_hierarchy"
    | "content_density"
    | "task_flow"
    | "visual_hierarchy"
    | "responsive"
    | "accessibility"
    | "state_completeness";
  evidence: string;
  why_it_matters: string;
  fix: string;
  affected_area: string;
};

export type ReviewInput = {
  url: string;
  goal: string;
  audience?: string;
  viewport?: string[];
  strictness?: "low" | "medium" | "high";
};

export type RenderedElementSummary = {
  text: string;
  role?: string;
  href?: string | null;
  tag: string;
};

export type LayoutElementMetric = {
  selector: string;
  tag: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font_size: number;
  font_weight: string;
  color: string;
  background_color: string;
  above_fold: boolean;
};

export type ViewportLayoutMetrics = {
  above_fold_action_count: number;
  primary_heading_area_ratio: number;
  tiny_tap_target_count: number;
  crowded_region_count: number;
  overlapping_element_count: number;
  cta_elements: LayoutElementMetric[];
  heading_elements: LayoutElementMetric[];
};

export type RenderedContextSummary = {
  title: string;
  final_url: string;
  captured_at: string;
  screenshots: Array<{ name: string; width: number; height: number; document_scroll_width?: number; body_scroll_width?: number; layout_metrics?: ViewportLayoutMetrics; path: string }>;
  headings: RenderedElementSummary[];
  buttons: RenderedElementSummary[];
  links: RenderedElementSummary[];
  forms: RenderedElementSummary[];
  text_sample: string;
};

export type RepairPlanStep = {
  issue_category: ReviewIssue["category"];
  severity: ReviewSeverity;
  region: string;
  selector_hint: string;
  problem: string;
  change: string;
  constraints: string[];
  acceptance_checks: string[];
  regression_risks: string[];
};

export type VisionReviewSummary = {
  enabled: boolean;
  provider: string;
  model: string;
  score_delta: number;
  summary: string;
  issues: ReviewIssue[];
  raw?: unknown;
};

export type ReviewReport = {
  score: number;
  verdict: string;
  product_stage: "spike-001-mcp-roundtrip" | "spike-002-render-dom-capture" | "spike-003-vision-judge";
  reviewed_url: string;
  assumptions: string[];
  rendered_context?: RenderedContextSummary;
  vision_review?: VisionReviewSummary;
  top_issues: ReviewIssue[];
  repair_plan: RepairPlanStep[];
  repair_prompt: string;
  next_experiment: string;
};

export type RenderedUiLike = {
  title: string;
  final_url: string;
  captured_at: string;
  viewports: Array<{ name: string; width: number; height: number; document_scroll_width?: number; body_scroll_width?: number; layout_metrics?: ViewportLayoutMetrics; screenshot_path: string }>;
  headings: RenderedElementSummary[];
  buttons: RenderedElementSummary[];
  links: RenderedElementSummary[];
  forms: RenderedElementSummary[];
  text_sample: string;
};

export type ReviewDiffReport = {
  product_stage: "spike-005-review-diff";
  verdict: "improved" | "regressed" | "unchanged";
  score_before: number;
  score_after: number;
  score_delta: number;
  issue_count_before: number;
  issue_count_after: number;
  issue_count_delta: number;
  high_severity_before: number;
  high_severity_after: number;
  high_severity_delta: number;
  fixed_issue_categories: ReviewIssue["category"][];
  introduced_issue_categories: ReviewIssue["category"][];
  remaining_issue_categories: ReviewIssue["category"][];
  summary: string;
  scorecard: Array<{ metric: string; before: number | string; after: number | string; delta: number | string }>;
  codex_next_action: string;
};

function hasUsefulGoal(goal: string): boolean {
  return goal.trim().split(/\s+/).length >= 8;
}

function textLength(text: string | undefined): number {
  return (text ?? "").replace(/\s+/g, " ").trim().length;
}

function primaryHeading(rendered?: RenderedUiLike): string {
  return rendered?.headings.find((heading) => heading.tag === "h1")?.text ?? "";
}

function selectorHintFor(issue: ReviewIssue, rendered?: RenderedUiLike): string {
  const desktopMetrics = rendered?.viewports.find((viewport) => viewport.name === "desktop")?.layout_metrics;
  const mobileMetrics = rendered?.viewports.find((viewport) => viewport.name === "mobile")?.layout_metrics;
  if (issue.affected_area.includes("hero") || issue.affected_area.includes("heading")) {
    return desktopMetrics?.heading_elements.find((item) => item.tag === "h1")?.selector ?? "h1 / hero section";
  }
  if (issue.category === "task_flow") {
    return desktopMetrics?.cta_elements.find((item) => item.above_fold)?.selector ?? "above-the-fold CTA group";
  }
  if (issue.category === "responsive") {
    return mobileMetrics?.cta_elements.find((item) => item.above_fold)?.selector ?? "mobile viewport layout";
  }
  if (issue.category === "state_completeness") return "form / onboarding flow";
  if (issue.category === "information_hierarchy") return "navigation and section headings";
  return issue.affected_area || "page section";
}

function regionFor(issue: ReviewIssue): string {
  if (issue.affected_area.includes("hero") || issue.affected_area.includes("heading")) return "hero";
  if (issue.affected_area.includes("CTA") || issue.category === "task_flow") return "primary action path";
  if (issue.category === "responsive") return "mobile layout";
  if (issue.category === "state_completeness") return "form state";
  if (issue.category === "information_hierarchy") return "navigation / information architecture";
  return issue.affected_area || "page";
}

function acceptanceChecksFor(issue: ReviewIssue): string[] {
  const checks = ["Rerun review_ui_url with desktop and mobile viewports."];
  if (issue.category === "responsive") checks.push("Mobile rendered scroll width is not wider than viewport width.");
  if (issue.category === "task_flow") checks.push("Above the fold has one obvious primary action and secondary actions are visually demoted.");
  if (issue.category === "intent_fit") checks.push("H1 names the product/job-to-be-done and matches the provided audience/goal.");
  if (issue.category === "state_completeness") checks.push("Form or flow exposes clear progress, required fields, submit, cancel/recovery, and success/error state copy.");
  if (issue.category === "visual_hierarchy") checks.push("Spacing, sizing, and card density create a clear scan path before adding any new sections.");
  checks.push("Run review_ui_diff against the baseline report and reject regressions in high-severity count.");
  return checks;
}

function buildRepairPlan(issues: ReviewIssue[], rendered?: RenderedUiLike): RepairPlanStep[] {
  return issues.slice(0, 6).map((issue) => ({
    issue_category: issue.category,
    severity: issue.severity,
    region: regionFor(issue),
    selector_hint: selectorHintFor(issue, rendered),
    problem: issue.evidence,
    change: issue.fix,
    constraints: [
      "Preserve the product intent and existing information architecture unless the issue explicitly names it.",
      "Prefer editing existing components/copy before adding new sections.",
      "Keep the mobile layout one-column where density or overflow is involved."
    ],
    acceptance_checks: acceptanceChecksFor(issue),
    regression_risks: [
      "Do not introduce horizontal overflow, duplicate primary CTAs, or weaker H1 clarity.",
      "Do not make the page prettier while hiding the original task or conversion path."
    ]
  }));
}

export function reviewUiUrl(input: ReviewInput, rendered?: RenderedUiLike, vision?: VisionReviewSummary): ReviewReport {
  const strictness = input.strictness ?? "medium";
  const viewports = input.viewport?.length ? input.viewport : ["desktop", "mobile"];
  const issues: ReviewIssue[] = [];

  if (!hasUsefulGoal(input.goal)) {
    issues.push({
      severity: "high",
      category: "intent_fit",
      evidence: "The review goal is too short to judge whether the UI solves the user's real problem.",
      why_it_matters: "AI-generated UI often looks polished while optimizing for the wrong user intent.",
      fix: "Provide a concrete product goal, target user, primary task, and desired conversion/action.",
      affected_area: "product brief"
    });
  }

  if (!input.audience || input.audience.trim().length < 12) {
    issues.push({
      severity: "medium",
      category: "information_hierarchy",
      evidence: "No specific audience was provided for the review.",
      why_it_matters: "Information density and layout priority depend heavily on whether the user is a founder, developer, designer, buyer, or end user.",
      fix: "Specify the target audience before asking the agent to repair UI hierarchy.",
      affected_area: "review context"
    });
  }

  if (!viewports.includes("mobile")) {
    issues.push({
      severity: "medium",
      category: "responsive",
      evidence: "The requested review does not include a mobile viewport.",
      why_it_matters: "Frontend agents frequently generate desktop-first layouts that collapse poorly on mobile.",
      fix: "Include mobile in the viewport list and gate high-severity responsive issues before shipping.",
      affected_area: "viewport coverage"
    });
  }

  if (!rendered) {
    issues.push({
      severity: strictness === "high" ? "high" : "medium",
      category: "visual_hierarchy",
      evidence: "No rendered screenshot or DOM context was captured, so visual hierarchy cannot be verified from pixels.",
      why_it_matters: "A real reviewer must inspect rendered output, not just the prompt, because layout bugs live in the browser.",
      fix: "Run the Playwright renderer and include desktop/mobile screenshots plus DOM extraction.",
      affected_area: "renderer pipeline"
    });
  } else {
    const h1 = primaryHeading(rendered);
    const buttonCount = rendered.buttons.length;
    const headingCount = rendered.headings.length;
    const linkCount = rendered.links.length;
    const formControlCount = rendered.forms.filter((item) => item.tag !== "form").length;
    const bodyLength = textLength(rendered.text_sample);
    const desktopMetrics = rendered.viewports.find((viewport) => viewport.name === "desktop")?.layout_metrics;
    const mobileViewport = rendered.viewports.find((viewport) => viewport.name === "mobile");
    const mobileMetrics = mobileViewport?.layout_metrics;

    if (!h1 || h1.length < 24) {
      issues.push({
        severity: "high",
        category: "intent_fit",
        evidence: h1 ? `Primary heading is vague or too short: "${h1}".` : "No H1 was found in the rendered DOM.",
        why_it_matters: "The first heading should quickly tell the target user what the product does and why it matters.",
        fix: "Rewrite the H1 around the user's job-to-be-done, e.g. 'Review and repair AI-generated UI before it ships'.",
        affected_area: "hero heading"
      });
    }

    if (buttonCount > 3) {
      issues.push({
        severity: "high",
        category: "task_flow",
        evidence: `Rendered DOM exposes ${buttonCount} button-like actions near the page, which likely creates competing CTAs.`,
        why_it_matters: "AI-generated landing pages often add too many actions, making the primary next step unclear.",
        fix: "Keep one primary CTA above the fold, move secondary actions into a lower-priority row, and label the MCP install path clearly.",
        affected_area: "CTA group"
      });
    }

    if (bodyLength > 900 && headingCount < 4) {
      issues.push({
        severity: "medium",
        category: "content_density",
        evidence: `The rendered page has about ${bodyLength} characters of visible text but only ${headingCount} headings for scan structure.`,
        why_it_matters: "Dense AI-written copy without strong sectioning makes the page hard to scan and weakens the information hierarchy.",
        fix: "Split dense copy into short sections: problem, how it works, MCP/API demo, and pricing/next step.",
        affected_area: "page copy structure"
      });
    }

    if (linkCount > 14 && headingCount < 5) {
      issues.push({
        severity: "medium",
        category: "information_hierarchy",
        evidence: `Rendered DOM exposes ${linkCount} links but only ${headingCount} headings, which makes navigation priority unclear.`,
        why_it_matters: "AI-generated dashboards often create many equally weighted nav/actions without showing the primary workflow.",
        fix: "Group navigation into fewer primary sections, add task-oriented headings, and demote secondary actions.",
        affected_area: "navigation and page structure"
      });
    }

    if (formControlCount >= 6 && buttonCount >= 3) {
      issues.push({
        severity: "medium",
        category: "state_completeness",
        evidence: `Rendered DOM exposes ${formControlCount} form controls and ${buttonCount} button-like actions without an obvious step/state hierarchy.`,
        why_it_matters: "AI-generated onboarding screens often dump every field and action at once, causing unclear progress, validation, and recovery states.",
        fix: "Split the form into ordered steps, show required fields, keep one primary submit action, and add clear save/cancel/error states.",
        affected_area: "form flow"
      });
    }

    if (mobileViewport && Math.max(mobileViewport.document_scroll_width ?? 0, mobileViewport.body_scroll_width ?? 0) > mobileViewport.width + 4) {
      const observedWidth = Math.max(mobileViewport.document_scroll_width ?? 0, mobileViewport.body_scroll_width ?? 0);
      issues.push({
        severity: "high",
        category: "responsive",
        evidence: `Mobile viewport width is ${mobileViewport.width}px but rendered scroll width is ${observedWidth}px, indicating horizontal overflow.`,
        why_it_matters: "Horizontal overflow is a common AI-generated layout failure that crops content and breaks mobile task completion.",
        fix: "Replace fixed-width grids/cards with minmax(0, 1fr), wrap dense tables, and collapse sections to one column on mobile.",
        affected_area: "mobile layout"
      });
    }

    if ((desktopMetrics?.above_fold_action_count ?? 0) > 4) {
      issues.push({
        severity: "high",
        category: "task_flow",
        evidence: `Layout metrics found ${desktopMetrics?.above_fold_action_count} clickable/action elements above the desktop fold.`,
        why_it_matters: "Rendered action density is a stronger signal than DOM counts alone; too many above-fold actions makes the primary workflow ambiguous.",
        fix: "Choose one primary CTA above the fold, demote secondary links, and move low-priority actions below the first decision point.",
        affected_area: "above-fold CTA cluster"
      });
    }

    if ((mobileMetrics?.tiny_tap_target_count ?? 0) > 0) {
      issues.push({
        severity: "medium",
        category: "accessibility",
        evidence: `Layout metrics found ${mobileMetrics?.tiny_tap_target_count} above-fold mobile action target(s) below the safe tap-target size.`,
        why_it_matters: "Small tap targets create real mobile friction even when the page appears visually acceptable in a screenshot.",
        fix: "Increase action hit areas to at least 40px wide and 36px tall, with enough spacing between adjacent links/buttons.",
        affected_area: "mobile action targets"
      });
    }

    if ((desktopMetrics?.overlapping_element_count ?? 0) > 0 || (mobileMetrics?.overlapping_element_count ?? 0) > 0) {
      issues.push({
        severity: "high",
        category: "visual_hierarchy",
        evidence: `Layout metrics detected overlapping action elements (desktop: ${desktopMetrics?.overlapping_element_count ?? 0}, mobile: ${mobileMetrics?.overlapping_element_count ?? 0}).`,
        why_it_matters: "Overlapping controls are a common AI-generated layout failure that screenshots may hide until interaction.",
        fix: "Separate stacked controls with explicit flex/grid gaps, remove absolute positioning where possible, and verify both viewports.",
        affected_area: "interactive layout"
      });
    }

    if ((desktopMetrics?.crowded_region_count ?? 0) > 2 || (mobileMetrics?.crowded_region_count ?? 0) > 1) {
      issues.push({
        severity: "medium",
        category: "content_density",
        evidence: `Layout metrics detected crowded regions (desktop: ${desktopMetrics?.crowded_region_count ?? 0}, mobile: ${mobileMetrics?.crowded_region_count ?? 0}).`,
        why_it_matters: "Crowded cards/sections make generated pages look polished but hard to scan and act on.",
        fix: "Break dense regions into fewer cards, shorten copy, increase section spacing, and expose one decision per region.",
        affected_area: "dense cards / sections"
      });
    }

    if (desktopMetrics && desktopMetrics.primary_heading_area_ratio > 0 && desktopMetrics.primary_heading_area_ratio < 0.01) {
      issues.push({
        severity: "medium",
        category: "visual_hierarchy",
        evidence: `Primary H1 occupies only ${(desktopMetrics.primary_heading_area_ratio * 100).toFixed(1)}% of the desktop viewport area.`,
        why_it_matters: "A visually underweighted H1 weakens the first scan path even when the text is technically present.",
        fix: "Increase hero heading scale/weight or reduce competing chrome so the product promise anchors the first viewport.",
        affected_area: "hero heading visual weight"
      });
    }

    if (!rendered.viewports.some((viewport) => viewport.name === "mobile")) {
      issues.push({
        severity: "medium",
        category: "responsive",
        evidence: "Renderer did not capture a mobile screenshot.",
        why_it_matters: "Mobile rendering evidence is required before claiming layout quality.",
        fix: "Capture a mobile viewport and check for horizontal overflow, CTA visibility, and readable density.",
        affected_area: "mobile viewport"
      });
    }
  }

  const allIssues = vision ? [...issues, ...vision.issues] : issues;
  const repairPlan = buildRepairPlan(allIssues, rendered);
  const penalty = allIssues.reduce((sum, issue) => sum + (issue.severity === "high" ? 18 : issue.severity === "medium" ? 10 : 4), 0);
  const baseScore = Math.max(0, Math.min(100, 100 - penalty));
  const score = Math.max(0, Math.min(100, baseScore + (vision?.score_delta ?? 0)));
  const productStage = vision ? "spike-003-vision-judge" : rendered ? "spike-002-render-dom-capture" : "spike-001-mcp-roundtrip";

  return {
    score,
    verdict: score >= 85 ? "ready for repair-loop validation" : score >= 65 ? "usable but has UX issues to repair" : "major UI/UX risks detected",
    product_stage: productStage,
    reviewed_url: input.url,
    assumptions: [
      vision?.enabled
        ? `This report combines deterministic DOM heuristics with ${vision.provider} vision review (${vision.model}).`
        : rendered
          ? "This report uses browser-rendered screenshot paths and DOM summaries, but not model-based vision judging yet."
          : "This is a connectivity/product-shape review without browser evidence yet.",
      vision && !vision.enabled ? vision.summary : "The returned schema is intentionally close to the future API/MCP contract.",
      `Requested viewports: ${viewports.join(", ")}.`
    ],
    rendered_context: rendered
      ? {
          title: rendered.title,
          final_url: rendered.final_url,
          captured_at: rendered.captured_at,
          screenshots: rendered.viewports.map((viewport) => ({
            name: viewport.name,
            width: viewport.width,
            height: viewport.height,
            document_scroll_width: viewport.document_scroll_width,
            body_scroll_width: viewport.body_scroll_width,
            layout_metrics: viewport.layout_metrics,
            path: viewport.screenshot_path
          })),
          headings: rendered.headings.slice(0, 12),
          buttons: rendered.buttons.slice(0, 12),
          links: rendered.links.slice(0, 12),
          forms: rendered.forms.slice(0, 12),
          text_sample: rendered.text_sample.slice(0, 1200)
        }
      : undefined,
    vision_review: vision,
    top_issues: allIssues,
    repair_plan: repairPlan,
    repair_prompt: [
      "Use this review as a concrete repair contract.",
      repairPlan.length ? `Apply the repair_plan steps in order, starting with ${repairPlan[0].region} (${repairPlan[0].selector_hint}).` : "No repair_plan steps were generated; preserve the current UI and only verify.",
      vision?.enabled
        ? "Prioritize high-severity vision and DOM issues, then run review_ui_url again with use_vision=true."
        : rendered
          ? "Fix the high-severity issues using the rendered DOM and screenshot evidence, then run review_ui_url again."
          : "Do not treat visual quality as validated until screenshots and DOM are captured.",
      "Optimize for one clear primary user task, one primary CTA, concise above-the-fold copy, and mobile-safe layout."
    ].join(" "),
    next_experiment: vision?.enabled
      ? "Spike 004: close the repair loop by letting Codex apply the repair_prompt, re-rendering, and measuring score improvement before/after."
      : vision
        ? "Configure a real OpenAI API key with responses/write scope, then re-run use_vision=true to validate model-based screenshot critique."
        : rendered
          ? "Spike 003: add a vision LLM judge over the captured screenshots and compare its issues against this deterministic DOM heuristic report."
          : "Spike 002: render the URL with Playwright, capture desktop/mobile screenshots, extract DOM text/headings/buttons, then feed that packet into this same report schema."
  };
}

function issueKey(issue: ReviewIssue): string {
  return `${issue.severity}:${issue.category}:${issue.affected_area}:${issue.evidence}`;
}

function severityCount(report: ReviewReport, severity: ReviewSeverity): number {
  return report.top_issues.filter((issue) => issue.severity === severity).length;
}

function categorySet(issues: ReviewIssue[]): Set<ReviewIssue["category"]> {
  return new Set(issues.map((issue) => issue.category));
}

function sortedCategories(categories: Iterable<ReviewIssue["category"]>): ReviewIssue["category"][] {
  return [...categories].sort();
}

export function compareReviewReports(before: ReviewReport, after: ReviewReport): ReviewDiffReport {
  const scoreDelta = after.score - before.score;
  const issueDelta = after.top_issues.length - before.top_issues.length;
  const highBefore = severityCount(before, "high");
  const highAfter = severityCount(after, "high");
  const highDelta = highAfter - highBefore;

  const beforeCategories = categorySet(before.top_issues);
  const afterCategories = categorySet(after.top_issues);
  const beforeIssueKeys = new Set(before.top_issues.map(issueKey));
  const introducedIssues = after.top_issues.filter((issue) => !beforeIssueKeys.has(issueKey(issue)));

  const fixedCategories = sortedCategories([...beforeCategories].filter((category) => !afterCategories.has(category)));
  const introducedCategories = sortedCategories([...afterCategories].filter((category) => !beforeCategories.has(category)));
  const remainingCategories = sortedCategories([...afterCategories].filter((category) => beforeCategories.has(category)));

  const verdict: ReviewDiffReport["verdict"] =
    scoreDelta > 0 && highAfter <= highBefore && after.top_issues.length <= before.top_issues.length
      ? "improved"
      : scoreDelta < 0 || highAfter > highBefore || after.top_issues.length > before.top_issues.length
        ? "regressed"
        : "unchanged";

  const summary =
    verdict === "improved"
      ? `Repair loop improved the UI review score by ${scoreDelta} points and reduced high-severity issues from ${highBefore} to ${highAfter}.`
      : verdict === "regressed"
        ? `Repair loop regressed: score changed by ${scoreDelta} and high-severity issues changed from ${highBefore} to ${highAfter}.`
        : `Repair loop was neutral: score stayed at ${after.score} and issue count changed by ${issueDelta}.`;

  return {
    product_stage: "spike-005-review-diff",
    verdict,
    score_before: before.score,
    score_after: after.score,
    score_delta: scoreDelta,
    issue_count_before: before.top_issues.length,
    issue_count_after: after.top_issues.length,
    issue_count_delta: issueDelta,
    high_severity_before: highBefore,
    high_severity_after: highAfter,
    high_severity_delta: highDelta,
    fixed_issue_categories: fixedCategories,
    introduced_issue_categories: introducedCategories,
    remaining_issue_categories: remainingCategories,
    summary,
    scorecard: [
      { metric: "score", before: before.score, after: after.score, delta: scoreDelta },
      { metric: "total_issues", before: before.top_issues.length, after: after.top_issues.length, delta: issueDelta },
      { metric: "high_severity_issues", before: highBefore, after: highAfter, delta: highDelta },
      { metric: "fixed_categories", before: sortedCategories(beforeCategories).join(", ") || "none", after: fixedCategories.join(", ") || "none", delta: fixedCategories.length }
    ],
    codex_next_action:
      verdict === "improved"
        ? introducedIssues.length
          ? "Keep the repair, but inspect introduced issues before shipping."
          : "Keep the repair and use the after report as the new baseline."
        : verdict === "regressed"
          ? "Revert or revise the repair, then rerun review_ui_url and review_ui_diff."
          : "Make a more targeted UI repair, then rerun review_ui_url and review_ui_diff."
  };
}
