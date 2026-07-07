export type ReviewSeverity = "low" | "medium" | "high";
export type ReviewTasteProfile = "simplicity" | "balanced" | "complexity";

export type ReviewPreferences = {
  taste_profile?: ReviewTasteProfile;
  density_tolerance?: number;
  action_tolerance?: number;
  hierarchy_strictness?: number;
};

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
  principle?: string;
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
  taste_profile?: ReviewTasteProfile;
  preferences?: ReviewPreferences;
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
  center_offset_px?: number;
  text_overflow?: boolean;
  above_fold: boolean;
};

export type ViewportLayoutMetrics = {
  above_fold_action_count: number;
  primary_heading_area_ratio: number;
  tiny_tap_target_count: number;
  unlabeled_action_count?: number;
  crowded_region_count: number;
  overlapping_element_count: number;
  unsafe_translucent_overlay_count?: number;
  misaligned_section_heading_count?: number;
  cramped_peer_card_count?: number;
  peer_card_imbalance_count?: number;
  weak_primary_card_text_count?: number;
  over_carded_section_count?: number;
  tight_block_spacing_count?: number;
  unique_font_family_count?: number;
  dominant_font_family?: string;
  gradient_text_count?: number;
  side_accent_card_count?: number;
  nested_card_depth?: number;
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

function clampPreference(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

function normalizeReviewPreferences(input: ReviewInput): Required<ReviewPreferences> {
  const tasteProfile = input.preferences?.taste_profile ?? input.taste_profile ?? "balanced";
  const base = tasteProfile === "simplicity"
    ? { density_tolerance: 0.28, action_tolerance: 0.25, hierarchy_strictness: 0.82 }
    : tasteProfile === "complexity"
      ? { density_tolerance: 0.78, action_tolerance: 0.72, hierarchy_strictness: 0.62 }
      : { density_tolerance: 0.5, action_tolerance: 0.5, hierarchy_strictness: 0.7 };
  return {
    taste_profile: tasteProfile,
    density_tolerance: clampPreference(input.preferences?.density_tolerance, base.density_tolerance),
    action_tolerance: clampPreference(input.preferences?.action_tolerance, base.action_tolerance),
    hierarchy_strictness: clampPreference(input.preferences?.hierarchy_strictness, base.hierarchy_strictness)
  };
}

function preferenceGuidance(preferences: Required<ReviewPreferences>): string {
  if (preferences.taste_profile === "simplicity") {
    return "Preference profile: simplicity. Be stricter about extra CTAs, dense regions, nested cards, and decorative complexity; favor calm scan paths.";
  }
  if (preferences.taste_profile === "complexity") {
    return "Preference profile: complexity. Allow richer information density when grouping, hierarchy, progressive disclosure, and tap targets remain clear.";
  }
  return "Preference profile: balanced. Prefer clear hierarchy and moderate density without forcing every product into ultra-minimal UI.";
}

export const UX_PRINCIPLE_REFERENCES = [
  {
    source: "Nielsen Norman Group",
    title: "10 Usability Heuristics for User Interface Design",
    url: "https://www.nngroup.com/articles/ten-usability-heuristics/",
    applied_principles: ["visibility of system status", "consistency and standards", "error prevention", "recognition rather than recall"]
  },
  {
    source: "W3C WAI",
    title: "WCAG 2.2 overview",
    url: "https://www.w3.org/WAI/standards-guidelines/wcag/",
    applied_principles: ["perceivable", "operable", "understandable", "robust"]
  },
  {
    source: "Ben Shneiderman, University of Maryland",
    title: "Eight Golden Rules of Interface Design",
    url: "https://www.cs.umd.edu/users/ben/goldenrules.html",
    applied_principles: ["strive for consistency", "offer informative feedback", "prevent errors", "permit easy reversal"]
  },
  {
    source: "Don Norman",
    title: "The Design of Everyday Things",
    url: "https://ia902800.us.archive.org/3/items/thedesignofeverydaythingsbydonnorman/The+Design+of+Everyday+Things+by+Don+Norman.pdf",
    applied_principles: ["discoverability", "signifiers", "feedback", "constraints", "mapping"]
  },
  {
    source: "Laws of UX",
    title: "Fitts's Law, Hick's Law, Jakob's Law, Miller's Law, Gestalt principles",
    url: "https://lawsofux.com/",
    applied_principles: ["large reachable targets", "reduce decision complexity", "group related content", "limit working-memory load"]
  },
  {
    source: "Apple Human Interface Guidelines / Material Design accessibility",
    title: "Platform guidance for visual hierarchy, touch targets, and accessibility",
    url: "https://developer.apple.com/design/human-interface-guidelines/",
    applied_principles: ["clarity", "deference", "depth", "sufficient contrast", "minimum target size"]
  }
] as const;

const VAGUE_ACTION_LABELS = new Set(["learn more", "read more", "more", "get started", "click here", "submit", "continue", "next", "start"]);
const FORM_FEEDBACK_WORDS = /\b(required|optional|error|invalid|try again|success|sent|saved|loading|checking|validat(?:e|ion)|hint|help|cancel|back|undo|confirm)\b/i;
const AI_SLOP_BUZZWORDS = /\b(supercharge|streamline|empower|world-class|enterprise-grade|next-generation|revolutionary|revolutionize|seamless|unlock|game-changing|cutting-edge|transform your workflow)\b/i;
const AI_CADENCE_COPY = /\b(not just|more than)\b.{0,80}\b(it'?s|we'?re|a)\b|\bnot a\b.{0,40}\ba\b/i;

function headingLevel(tag: string): number | null {
  const match = tag.toLowerCase().match(/^h([1-6])$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function repeatedVagueActionLabels(actions: RenderedElementSummary[]): string[] {
  const counts = new Map<string, number>();
  for (const action of actions) {
    const label = action.text.replace(/\s+/g, " ").trim().toLowerCase();
    if (!label || !VAGUE_ACTION_LABELS.has(label)) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count >= 2).map(([label, count]) => `${label} ×${count}`);
}

function parseCssColor(input: string): [number, number, number, number] | null {
  const value = input.trim().toLowerCase();
  if (!value || value === "transparent" || value === "rgba(0, 0, 0, 0)") return null;
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].split("").map((part) => part + part).join("") : hex[1];
    return [Number.parseInt(raw.slice(0, 2), 16), Number.parseInt(raw.slice(2, 4), 16), Number.parseInt(raw.slice(4, 6), 16), 1];
  }
  const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgb) return null;
  const parts = rgb[1].split(",").map((part) => Number.parseFloat(part.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some((part) => Number.isNaN(part))) return null;
  return [parts[0], parts[1], parts[2], parts.length >= 4 && !Number.isNaN(parts[3]) ? parts[3] : 1];
}

function relativeLuminance([red, green, blue]: [number, number, number, number]): number {
  const channel = (value: number) => {
    const normalized = Math.max(0, Math.min(255, value)) / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseCssColor(foreground);
  const bg = parseCssColor(background);
  if (!fg || !bg || fg[3] < 1 || bg[3] < 1) return null;
  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

function minContrastFor(metric: LayoutElementMetric): number {
  const numericWeight = Number.parseInt(metric.font_weight, 10) || 400;
  return metric.font_size >= 24 || (metric.font_size >= 18.66 && numericWeight >= 700) ? 3 : 4.5;
}

function lowContrastElements(metrics?: ViewportLayoutMetrics): Array<{ metric: LayoutElementMetric; ratio: number; required: number }> {
  if (!metrics) return [];
  return [...metrics.cta_elements, ...metrics.heading_elements]
    .map((metric) => {
      const ratio = contrastRatio(metric.color, metric.background_color);
      const required = minContrastFor(metric);
      return ratio === null || ratio >= required ? null : { metric, ratio, required };
    })
    .filter((item): item is { metric: LayoutElementMetric; ratio: number; required: number } => Boolean(item));
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
  if (issue.category === "information_hierarchy") checks.push("Heading levels progress semantically and labels let users recognize the next step without memorizing context.");
  if (issue.category === "accessibility") checks.push("Text/action contrast meets WCAG-style thresholds and mobile targets are at least 44×44 CSS px.");
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
  const preferences = normalizeReviewPreferences(input);
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
    const headingLevels = rendered.headings.map((heading) => ({ heading, level: headingLevel(heading.tag) })).filter((item): item is { heading: RenderedElementSummary; level: number } => item.level !== null);
    const skippedHeading = headingLevels.slice(1).find((item, index) => item.level - headingLevels[index].level > 1);
    const vagueRepeatedLabels = repeatedVagueActionLabels(rendered.buttons);
    const lowContrast = [
      ...lowContrastElements(desktopMetrics).map((item) => ({ ...item, viewport: "desktop" })),
      ...lowContrastElements(mobileMetrics).map((item) => ({ ...item, viewport: "mobile" }))
    ];
    const emDashCount = (rendered.text_sample.match(/—/g) ?? []).length;
    const linkStructureLimit = preferences.taste_profile === "simplicity" ? 10 : preferences.taste_profile === "complexity" ? 22 : 14;
    const formControlLimit = preferences.taste_profile === "simplicity" ? 4 : preferences.taste_profile === "complexity" ? 10 : 6;
    const formButtonLimit = preferences.taste_profile === "simplicity" ? 2 : preferences.taste_profile === "complexity" ? 4 : 3;
    const aboveFoldActionLimit = preferences.taste_profile === "simplicity" ? 3 : preferences.taste_profile === "complexity" ? 6 : 4;
    const crowdedDesktopLimit = preferences.taste_profile === "simplicity" ? 1 : preferences.taste_profile === "complexity" ? 4 : 2;
    const crowdedMobileLimit = preferences.taste_profile === "simplicity" ? 0 : preferences.taste_profile === "complexity" ? 2 : 1;

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

    if (skippedHeading) {
      const previous = headingLevels[headingLevels.indexOf(skippedHeading) - 1];
      issues.push({
        severity: "medium",
        category: "information_hierarchy",
        principle: "Gestalt grouping, Nielsen recognition rather than recall, and Apple clarity: heading levels should create a predictable scan path.",
        evidence: `Heading level jumps from ${previous.heading.tag.toUpperCase()} to ${skippedHeading.heading.tag.toUpperCase()} near "${skippedHeading.heading.text.slice(0, 80)}".`,
        why_it_matters: "Skipped heading levels make content harder to scan, weaken information architecture, and can confuse assistive technology users.",
        fix: "Reorder headings by semantic depth (H1 → H2 → H3), and use visual styling instead of heading-level jumps for size changes.",
        affected_area: "heading hierarchy"
      });
    }

    if (vagueRepeatedLabels.length > 0) {
      issues.push({
        severity: "medium",
        category: "task_flow",
        principle: "Hick's Law, Nielsen consistency/recognition, and Shneiderman consistency: reduce ambiguous choices and make actions specific.",
        evidence: `Vague repeated action labels found: ${vagueRepeatedLabels.join(", ")}.`,
        why_it_matters: "Repeated generic CTAs force users to remember page context and compare ambiguous choices instead of recognizing the right next step.",
        fix: "Replace repeated generic labels with task-specific actions such as 'Run UX review', 'View API docs', or 'Compare before/after report'.",
        affected_area: "CTA labels"
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

    if (AI_SLOP_BUZZWORDS.test(rendered.text_sample)) {
      issues.push({
        severity: "medium",
        category: "intent_fit",
        principle: "Specificity over generated-marketing cadence: copy should name the literal product action, audience, and outcome rather than generic SaaS adjectives.",
        evidence: "Visible copy contains generic high-gloss marketing language that reads like AI-generated SaaS filler.",
        why_it_matters: "Buzzwords can make a page feel polished while hiding what the product actually does, which weakens trust and conversion.",
        fix: "Replace generic phrases with concrete nouns and verbs tied to the product workflow, evidence, or user task.",
        affected_area: "marketing copy"
      });
    }

    if (emDashCount > 2 || AI_CADENCE_COPY.test(rendered.text_sample)) {
      issues.push({
        severity: "low",
        category: "content_density",
        principle: "Human voice and scannability: avoid repeated AI-cadence punctuation and aphoristic contrast lines unless they carry real product meaning.",
        evidence: emDashCount > 2 ? `Visible copy uses ${emDashCount} em dashes, which can create an AI-written cadence.` : "Visible copy contains repeated manufactured-contrast phrasing.",
        why_it_matters: "Over-stylized copy distracts from the user task and makes the interface feel generated rather than designed.",
        fix: "Use shorter concrete sentences, colons, commas, or plain labels; keep contrast lines only when they clarify the product.",
        affected_area: "copy voice"
      });
    }

    if (linkCount > linkStructureLimit && headingCount < 5) {
      issues.push({
        severity: "medium",
        category: "information_hierarchy",
        evidence: `Rendered DOM exposes ${linkCount} links but only ${headingCount} headings for a ${preferences.taste_profile} taste profile, which makes navigation priority unclear.`,
        why_it_matters: "AI-generated dashboards often create many equally weighted nav/actions without showing the primary workflow.",
        fix: "Group navigation into fewer primary sections, add task-oriented headings, and demote secondary actions.",
        affected_area: "navigation and page structure"
      });
    }

    if (formControlCount >= formControlLimit && buttonCount >= formButtonLimit) {
      issues.push({
        severity: "medium",
        category: "state_completeness",
        evidence: `Rendered DOM exposes ${formControlCount} form controls and ${buttonCount} button-like actions under the ${preferences.taste_profile} taste profile without an obvious step/state hierarchy.`,
        why_it_matters: "AI-generated onboarding screens often dump every field and action at once, causing unclear progress, validation, and recovery states.",
        fix: "Split the form into ordered steps, show required fields, keep one primary submit action, and add clear save/cancel/error states.",
        affected_area: "form flow"
      });
    }

    if (formControlCount > 0 && !FORM_FEEDBACK_WORDS.test(rendered.text_sample)) {
      issues.push({
        severity: "medium",
        category: "state_completeness",
        principle: "Nielsen visibility of system status, Shneiderman informative feedback/error prevention, and Norman feedback/signifiers.",
        evidence: `Form controls are present (${formControlCount}), but visible copy does not expose feedback, validation, required/optional hints, success, error, or recovery states.`,
        why_it_matters: "Forms need clear signifiers and feedback so users know what is required, what happened after submit, and how to recover from mistakes.",
        fix: "Add required/optional hints, inline validation/error copy, a loading/submitting state, success confirmation, and a cancel/back/retry recovery path.",
        affected_area: "form feedback and validation states"
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

    if ((desktopMetrics?.above_fold_action_count ?? 0) > aboveFoldActionLimit) {
      issues.push({
        severity: "high",
        category: "task_flow",
        evidence: `Layout metrics found ${desktopMetrics?.above_fold_action_count} clickable/action elements above the desktop fold, above the ${preferences.taste_profile} profile limit of ${aboveFoldActionLimit}.`,
        why_it_matters: "Rendered action density is a stronger signal than DOM counts alone; too many above-fold actions makes the primary workflow ambiguous.",
        fix: "Choose one primary CTA above the fold, demote secondary links, and move low-priority actions below the first decision point.",
        affected_area: "above-fold CTA cluster"
      });
    }

    if ((mobileMetrics?.tiny_tap_target_count ?? 0) > 0) {
      issues.push({
        severity: "medium",
        category: "accessibility",
        principle: "Fitts's Law, WCAG operable controls, Apple 44pt targets, and Material 48dp targets.",
        evidence: `Layout metrics found ${mobileMetrics?.tiny_tap_target_count} above-fold mobile action target(s) below a safe 44×44 tap-target size.`,
        why_it_matters: "Small tap targets create real mobile friction and missed taps even when the page appears visually acceptable in a screenshot.",
        fix: "Increase action hit areas to at least 44×44 CSS px, ideally 48×48 for Material-style controls, with enough spacing between adjacent links/buttons.",
        affected_area: "mobile action targets"
      });
    }

    if ((desktopMetrics?.unlabeled_action_count ?? 0) > 0 || (mobileMetrics?.unlabeled_action_count ?? 0) > 0) {
      issues.push({
        severity: "high",
        category: "accessibility",
        principle: "Norman signifiers/discoverability and WCAG understandable/robust controls.",
        evidence: `Layout metrics found unlabeled action targets (desktop: ${desktopMetrics?.unlabeled_action_count ?? 0}, mobile: ${mobileMetrics?.unlabeled_action_count ?? 0}).`,
        why_it_matters: "Icon-only or empty controls hide affordance from users and can be unusable for screen readers or voice control.",
        fix: "Give every action visible text or an accessible label, and keep the visual signifier close to the control it describes.",
        affected_area: "action labeling"
      });
    }

    if (lowContrast.length > 0) {
      const examples = lowContrast.slice(0, 3).map((item) => `${item.viewport} ${item.metric.selector} ${item.ratio}:1 < ${item.required}:1`).join(", ");
      issues.push({
        severity: "high",
        category: "accessibility",
        principle: "WCAG perceivable content and Material/Apple contrast guidance: text and controls must remain legible in rendered pixels.",
        evidence: `Rendered text/action contrast is below the recommended threshold: ${examples}.`,
        why_it_matters: "Low contrast makes copy and CTAs hard to perceive for low-vision users and often signals weak visual hierarchy for everyone.",
        fix: "Increase foreground/background contrast for affected headings and actions, targeting at least 4.5:1 for normal text and 3:1 for large bold text.",
        affected_area: "color contrast"
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

    if ((desktopMetrics?.unsafe_translucent_overlay_count ?? 0) > 0 || (mobileMetrics?.unsafe_translucent_overlay_count ?? 0) > 0) {
      issues.push({
        severity: "high",
        category: "accessibility",
        principle: "WCAG perceivable content and Nielsen visibility: sticky overlays need their own readable surface when they cross text, cards, or screenshots.",
        evidence: `Layout metrics found unsafe translucent overlay(s) crossing rendered content (desktop: ${desktopMetrics?.unsafe_translucent_overlay_count ?? 0}, mobile: ${mobileMetrics?.unsafe_translucent_overlay_count ?? 0}).`,
        why_it_matters: "Transparent headers can look clean on blank background but become unreadable when they overlap text, artifacts, screenshots, or mixed surfaces while scrolling.",
        fix: "Give sticky/fixed chrome an opaque or frosted surface with enough contrast, border/shadow separation, and verify it over both blank and content-heavy scroll positions.",
        affected_area: "sticky overlay readability"
      });
    }

    if ((desktopMetrics?.misaligned_section_heading_count ?? 0) > 0) {
      issues.push({
        severity: "medium",
        category: "visual_hierarchy",
        principle: "Gestalt alignment and Apple clarity: peer section headings should align with their intended scan axis, especially in centered hero/CTA bands.",
        evidence: `Layout metrics found ${desktopMetrics?.misaligned_section_heading_count} large desktop section heading(s) visually off-center from the viewport.`,
        why_it_matters: "A centered section with a left-shifted heading feels unbalanced and makes the scan path less calm even when text-align is set to center.",
        fix: "Center the heading block itself with margin-inline auto or a centered parent grid, then verify the rendered heading center matches the section center.",
        affected_area: "section heading alignment"
      });
    }

    if ((desktopMetrics?.cramped_peer_card_count ?? 0) > 0) {
      issues.push({
        severity: "medium",
        category: "visual_hierarchy",
        principle: "Gestalt similarity and common region: peer cards in the same hierarchy layer should have matching dimensions and enough room for their labels.",
        evidence: `Layout metrics found ${desktopMetrics?.cramped_peer_card_count} cramped peer card/label element(s) where text is too tight for its card width.`,
        why_it_matters: "If one card expands or crowds while siblings stay smaller, the hierarchy looks accidental and users over-read the wrong item.",
        fix: "Give peer cards the same minimum width/height, add label padding, and let the whole row expand or wrap together instead of stretching only one card.",
        affected_area: "peer card hierarchy"
      });
    }

    if ((desktopMetrics?.peer_card_imbalance_count ?? 0) > 0 || (mobileMetrics?.peer_card_imbalance_count ?? 0) > 0) {
      issues.push({
        severity: "medium",
        category: "visual_hierarchy",
        principle: "Gestalt similarity and common region: subscription/plan cards in the same choice set should feel like equal peers, not accidental content boxes.",
        evidence: `Layout metrics found imbalanced peer-card group(s) by size or density (desktop: ${desktopMetrics?.peer_card_imbalance_count ?? 0}, mobile: ${mobileMetrics?.peer_card_imbalance_count ?? 0}).`,
        why_it_matters: "Uneven plan/subscription cards make one option look broken or accidentally emphasized, even when no text technically overflows.",
        fix: "Use minmax(0, 1fr), equal min-heights, consistent inner grid rows, and balanced copy density so the whole choice set reads as one hierarchy layer.",
        affected_area: "subscription / peer cards"
      });
    }

    if ((desktopMetrics?.weak_primary_card_text_count ?? 0) > 0 || (mobileMetrics?.weak_primary_card_text_count ?? 0) > 0) {
      issues.push({
        severity: "medium",
        category: "visual_hierarchy",
        principle: "Primary labels inside cards should be visibly stronger than their border/background treatment.",
        evidence: `Rendered metrics found card labels that read as muted gray instead of primary text (desktop: ${desktopMetrics?.weak_primary_card_text_count ?? 0}, mobile: ${mobileMetrics?.weak_primary_card_text_count ?? 0}).`,
        why_it_matters: "When the label, border, and surface all have the same visual weight, users cannot tell what the card is asking them to notice.",
        fix: "Increase the primary card label color/weight first, then keep borders and backgrounds quieter. Do not solve hierarchy by adding another card shell.",
        affected_area: "card label hierarchy"
      });
    }

    if ((desktopMetrics?.over_carded_section_count ?? 0) > 0 || (mobileMetrics?.over_carded_section_count ?? 0) > 0) {
      issues.push({
        severity: "medium",
        category: "content_density",
        principle: "Use cards for real grouping boundaries; repeated adjacent cards turn a section into undifferentiated card soup.",
        evidence: `Rendered metrics found sections where a card grid is followed by additional card-like callouts (desktop: ${desktopMetrics?.over_carded_section_count ?? 0}, mobile: ${mobileMetrics?.over_carded_section_count ?? 0}).`,
        why_it_matters: "Stacking callout cards under card grids creates duplicate hierarchy and makes every block compete for equal attention.",
        fix: "Convert secondary callouts into inline evidence rows, dividers, notes, or a compact list so the primary card grid remains the only card layer.",
        affected_area: "over-carded section"
      });
    }

    if ((desktopMetrics?.tight_block_spacing_count ?? 0) > 0 || (mobileMetrics?.tight_block_spacing_count ?? 0) > 0) {
      issues.push({
        severity: "medium",
        category: "content_density",
        principle: "Large panels, code blocks, and previews need breathing room before follow-up body text.",
        evidence: `Layout metrics found panel-to-text gaps that are too tight for the surrounding line-height (desktop: ${desktopMetrics?.tight_block_spacing_count ?? 0}, mobile: ${mobileMetrics?.tight_block_spacing_count ?? 0}).`,
        why_it_matters: "When body copy is glued to the bottom edge of a dark or bordered block, users read it as an accidental caption or clipped content instead of the next instruction.",
        fix: "Add bottom margin after panels/code blocks or top margin before follow-up text; use spacing tied to body line-height rather than a fixed 4px gap.",
        affected_area: "spacing rhythm"
      });
    }

    if ((desktopMetrics?.gradient_text_count ?? 0) > 0 || (mobileMetrics?.gradient_text_count ?? 0) > 0) {
      issues.push({
        severity: "medium",
        category: "visual_hierarchy",
        principle: "Text should carry meaning before decoration; generated UIs often use gradient text as a taste shortcut instead of hierarchy.",
        evidence: `Rendered metrics found decorative gradient text (desktop: ${desktopMetrics?.gradient_text_count ?? 0}, mobile: ${mobileMetrics?.gradient_text_count ?? 0}).`,
        why_it_matters: "Gradient headings can reduce scannability and make the page feel generated unless the gradient is part of a deliberate brand system.",
        fix: "Use solid text color for headings/metrics, and move color into surfaces, illustrations, or small accents with clear purpose.",
        affected_area: "decorative text treatment"
      });
    }

    if ((desktopMetrics?.side_accent_card_count ?? 0) > 0 || (mobileMetrics?.side_accent_card_count ?? 0) > 0) {
      issues.push({
        severity: "medium",
        category: "visual_hierarchy",
        principle: "Edges and accents should clarify grouping; thick one-sided borders on rounded cards often read as generated decoration.",
        evidence: `Rendered metrics found thick one-sided accent border card(s) (desktop: ${desktopMetrics?.side_accent_card_count ?? 0}, mobile: ${mobileMetrics?.side_accent_card_count ?? 0}).`,
        why_it_matters: "The pattern adds visual noise without improving comprehension and can clash with card radius/elevation.",
        fix: "Remove the side stripe or replace it with a subtler icon, label, divider, or state-specific accent.",
        affected_area: "card decoration"
      });
    }

    if ((desktopMetrics?.nested_card_depth ?? 0) >= 3 || (mobileMetrics?.nested_card_depth ?? 0) >= 3) {
      issues.push({
        severity: "medium",
        category: "content_density",
        principle: "Flatten hierarchy: use spacing, typography, and dividers before stacking cards inside cards.",
        evidence: `Rendered metrics found deeply nested card structure (desktop depth: ${desktopMetrics?.nested_card_depth ?? 0}, mobile depth: ${mobileMetrics?.nested_card_depth ?? 0}).`,
        why_it_matters: "Nested containers create depth noise and make every region compete for attention.",
        fix: "Flatten nested panels, remove redundant card backgrounds, and reserve containers for real grouping boundaries.",
        affected_area: "nested cards"
      });
    }

    if ((desktopMetrics?.unique_font_family_count ?? 99) <= 1 && headingCount >= 4 && bodyLength > 500) {
      issues.push({
        severity: "low",
        category: "visual_hierarchy",
        principle: "Typography needs contrast and intent; a single default font across every heading, label, and paragraph can flatten the interface.",
        evidence: `Rendered text appears to use one dominant font family (${desktopMetrics?.dominant_font_family || "unknown"}) across a content-heavy page.`,
        why_it_matters: "One-font pages can be fine for utilities, but on marketing/docs surfaces they often remove voice and hierarchy.",
        fix: "Introduce typographic contrast through a deliberate display/body pairing or stronger size, weight, and spacing steps.",
        affected_area: "typographic system"
      });
    }

    if ((desktopMetrics?.crowded_region_count ?? 0) > crowdedDesktopLimit || (mobileMetrics?.crowded_region_count ?? 0) > crowdedMobileLimit) {
      issues.push({
        severity: "medium",
        category: "content_density",
        evidence: `Layout metrics detected crowded regions for the ${preferences.taste_profile} taste profile (desktop: ${desktopMetrics?.crowded_region_count ?? 0}/${crowdedDesktopLimit}, mobile: ${mobileMetrics?.crowded_region_count ?? 0}/${crowdedMobileLimit}).`,
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
      preferenceGuidance(preferences),
      `Deterministic principles applied: ${UX_PRINCIPLE_REFERENCES.map((reference) => reference.source).join(", ")}.`,
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
      preferenceGuidance(preferences),
      "Optimize for one clear primary user task, one primary CTA, concise above-the-fold copy, accessible contrast/tap targets, specific action labels, form feedback, and mobile-safe layout."
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
