import { readFile } from "node:fs/promises";
import type { RenderedUiLike, ReviewInput, ReviewIssue } from "../../reviewer-core/src/index.js";

export type VisionReview = {
  enabled: boolean;
  provider: "openai" | "fallback";
  model: string;
  score_delta: number;
  summary: string;
  issues: ReviewIssue[];
  raw?: unknown;
};

export type VisionJudgeOptions = {
  apiKey?: string;
  model?: string;
  maxScreenshots?: number;
};

const ISSUE_CATEGORIES = [
  "intent_fit",
  "information_hierarchy",
  "content_density",
  "task_flow",
  "visual_hierarchy",
  "responsive",
  "accessibility",
  "state_completeness"
] as const;

function isIssueCategory(value: string): value is ReviewIssue["category"] {
  return ISSUE_CATEGORIES.includes(value as ReviewIssue["category"]);
}

function asIssue(input: any): ReviewIssue | null {
  if (!input || typeof input !== "object") return null;
  const severity = input.severity === "high" || input.severity === "medium" || input.severity === "low" ? input.severity : "medium";
  const category = typeof input.category === "string" && isIssueCategory(input.category) ? input.category : "visual_hierarchy";
  const evidence = typeof input.evidence === "string" && input.evidence.trim() ? input.evidence.trim() : "Vision judge flagged this area, but returned weak evidence.";
  const why = typeof input.why_it_matters === "string" && input.why_it_matters.trim() ? input.why_it_matters.trim() : "This can reduce clarity or task completion.";
  const fix = typeof input.fix === "string" && input.fix.trim() ? input.fix.trim() : "Make the visual hierarchy and primary action more explicit.";
  const affected = typeof input.affected_area === "string" && input.affected_area.trim() ? input.affected_area.trim() : "screenshot";
  return { severity, category, evidence, why_it_matters: why, fix, affected_area: affected };
}

function safeJsonFromText(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Vision response did not contain JSON");
    return JSON.parse(match[0]);
  }
}

async function screenshotContent(rendered: RenderedUiLike, maxScreenshots: number) {
  return Promise.all(
    rendered.viewports.slice(0, maxScreenshots).map(async (viewport) => {
      const bytes = await readFile(viewport.screenshot_path);
      return {
        type: "input_image",
        image_url: `data:image/png;base64,${bytes.toString("base64")}`,
        detail: "low",
        viewport: viewport.name
      };
    })
  );
}

function buildPrompt(input: ReviewInput, rendered: RenderedUiLike): string {
  const headings = rendered.headings.map((h) => `${h.tag}: ${h.text}`).join("\n");
  const buttons = rendered.buttons.map((b) => `${b.tag}: ${b.text}`).join("\n");
  return `You are a strict senior product designer reviewing an AI-generated frontend.

Goal: ${input.goal}
Audience: ${input.audience ?? "not specified"}
URL: ${rendered.final_url}
Page title: ${rendered.title}

DOM headings:
${headings || "(none)"}

DOM buttons/actions:
${buttons || "(none)"}

Visible text sample:
${rendered.text_sample.slice(0, 1800)}

Review the screenshots and DOM together. Focus on whether the UI solves the user's need, not whether it is merely pretty.
Find at most 5 concrete issues. Prefer issues that a coding agent can repair.
Return strict JSON only with this shape:
{
  "score_delta": number, // negative if screenshots reveal extra risk, positive if screenshots reduce concern, usually -20..10
  "summary": string,
  "issues": [
    {
      "severity": "high" | "medium" | "low",
      "category": "intent_fit" | "information_hierarchy" | "content_density" | "task_flow" | "visual_hierarchy" | "responsive" | "accessibility" | "state_completeness",
      "evidence": string,
      "why_it_matters": string,
      "fix": string,
      "affected_area": string
    }
  ]
}`;
}

function fallbackVisionReview(rendered: RenderedUiLike): VisionReview {
  const hasMobile = rendered.viewports.some((viewport) => viewport.name === "mobile");
  const issues: ReviewIssue[] = [];
  if (!hasMobile) {
    issues.push({
      severity: "medium",
      category: "responsive",
      evidence: "Vision judge fallback could not inspect a mobile screenshot because none was captured.",
      why_it_matters: "AI-generated frontends often fail on mobile even when desktop looks acceptable.",
      fix: "Capture a mobile viewport and run the vision judge again.",
      affected_area: "mobile screenshot"
    });
  }
  return {
    enabled: false,
    provider: "fallback",
    model: "not-configured",
    score_delta: 0,
    summary: "Vision judge was requested but no OPENAI_API_KEY was configured. Returned deterministic fallback only; do not treat this as model-based visual critique.",
    issues
  };
}

export async function judgeRenderedUiWithVision(
  input: ReviewInput,
  rendered: RenderedUiLike,
  options: VisionJudgeOptions = {}
): Promise<VisionReview> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model = options.model ?? process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";
  if (!apiKey) return fallbackVisionReview(rendered);

  const images = await screenshotContent(rendered, options.maxScreenshots ?? 2);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildPrompt(input, rendered) },
            ...images.map(({ viewport, ...image }) => image)
          ]
        }
      ],
      max_output_tokens: 1800
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI vision request failed ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const text =
    data.output_text ??
    data.output?.flatMap((item: any) => item.content ?? [])?.map((content: any) => content.text ?? "")?.join("\n") ??
    "";
  const parsed = safeJsonFromText(text);
  const issues = Array.isArray(parsed.issues) ? parsed.issues.map(asIssue).filter(Boolean) as ReviewIssue[] : [];
  const scoreDelta = typeof parsed.score_delta === "number" ? Math.max(-30, Math.min(15, Math.round(parsed.score_delta))) : 0;
  const summary = typeof parsed.summary === "string" ? parsed.summary : "Vision model returned a valid but sparse review.";

  return {
    enabled: true,
    provider: "openai",
    model,
    score_delta: scoreDelta,
    summary,
    issues,
    raw: { id: data.id, usage: data.usage }
  };
}
