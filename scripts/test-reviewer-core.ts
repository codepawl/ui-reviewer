import assert from "node:assert/strict";
import { reviewUiUrl, type RenderedUiLike, type ReviewIssue } from "../packages/reviewer-core/src/index.js";

function baseRendered(overrides: Partial<RenderedUiLike> = {}): RenderedUiLike {
  return {
    title: "UXRay fixture",
    final_url: "http://fixture.local",
    captured_at: "2026-07-07T00:00:00.000Z",
    viewports: [
      {
        name: "desktop",
        width: 1440,
        height: 1000,
        document_scroll_width: 1440,
        body_scroll_width: 1440,
        screenshot_path: "/tmp/desktop.png",
        layout_metrics: {
          above_fold_action_count: 1,
          primary_heading_area_ratio: 0.035,
          tiny_tap_target_count: 0,
          crowded_region_count: 0,
          overlapping_element_count: 0,
          unsafe_translucent_overlay_count: 0,
          misaligned_section_heading_count: 0,
          cramped_peer_card_count: 0,
          peer_card_imbalance_count: 0,
          weak_primary_card_text_count: 0,
          over_carded_section_count: 0,
          tight_block_spacing_count: 0,
          unique_font_family_count: 2,
          dominant_font_family: "geist",
          gradient_text_count: 0,
          side_accent_card_count: 0,
          nested_card_depth: 0,
          cta_elements: [
            {
              selector: "a.primary",
              tag: "a",
              text: "Start review",
              x: 40,
              y: 320,
              width: 160,
              height: 48,
              font_size: 16,
              font_weight: "700",
              color: "rgb(255, 255, 255)",
              background_color: "rgb(0, 0, 0)",
              above_fold: true
            }
          ],
          heading_elements: [
            {
              selector: "h1",
              tag: "h1",
              text: "Review and repair AI-generated interfaces before they ship",
              x: 40,
              y: 120,
              width: 780,
              height: 96,
              font_size: 48,
              font_weight: "800",
              color: "rgb(0, 0, 0)",
              background_color: "rgb(255, 255, 255)",
              above_fold: true
            }
          ]
        }
      },
      {
        name: "mobile",
        width: 390,
        height: 844,
        document_scroll_width: 390,
        body_scroll_width: 390,
        screenshot_path: "/tmp/mobile.png",
        layout_metrics: {
          above_fold_action_count: 1,
          primary_heading_area_ratio: 0.04,
          tiny_tap_target_count: 0,
          crowded_region_count: 0,
          overlapping_element_count: 0,
          unsafe_translucent_overlay_count: 0,
          misaligned_section_heading_count: 0,
          cramped_peer_card_count: 0,
          peer_card_imbalance_count: 0,
          weak_primary_card_text_count: 0,
          over_carded_section_count: 0,
          tight_block_spacing_count: 0,
          unique_font_family_count: 2,
          dominant_font_family: "geist",
          gradient_text_count: 0,
          side_accent_card_count: 0,
          nested_card_depth: 0,
          cta_elements: [],
          heading_elements: []
        }
      }
    ],
    headings: [
      { tag: "h1", role: "heading", text: "Review and repair AI-generated interfaces before they ship" },
      { tag: "h2", role: "heading", text: "How it works" }
    ],
    buttons: [{ tag: "a", role: "button", text: "Start review", href: "#start" }],
    links: [{ tag: "a", role: "link", text: "Docs", href: "/docs" }],
    forms: [],
    text_sample: "Review AI-generated UI. Start review. Clear results, repair plan, and success states.",
    ...overrides
  };
}

function review(rendered: RenderedUiLike) {
  return reviewUiUrl(
    {
      url: rendered.final_url,
      goal: "Review and repair an AI-generated product page before it ships to customers.",
      audience: "AI builders and founders shipping frontend experiments",
      viewport: ["desktop", "mobile"],
      strictness: "high"
    },
    rendered
  );
}

function hasIssue(issues: ReviewIssue[], category: ReviewIssue["category"], evidence: RegExp): boolean {
  return issues.some((issue) => issue.category === category && evidence.test(issue.evidence));
}

{
  const rendered = baseRendered({
    viewports: [
      {
        ...baseRendered().viewports[0],
        layout_metrics: {
          ...baseRendered().viewports[0].layout_metrics!,
          cta_elements: [
            {
              ...baseRendered().viewports[0].layout_metrics!.cta_elements[0],
              color: "rgb(120, 120, 120)",
              background_color: "rgb(130, 130, 130)"
            }
          ],
          heading_elements: [
            {
              ...baseRendered().viewports[0].layout_metrics!.heading_elements[0],
              color: "#777",
              background_color: "#888"
            }
          ]
        }
      },
      baseRendered().viewports[1]
    ]
  });
  const report = review(rendered);
  assert.ok(
    hasIssue(report.top_issues, "accessibility", /contrast/i),
    "low-contrast actions/headings should be flagged as WCAG/Material accessibility issues"
  );
}

{
  const rendered = baseRendered({
    headings: [
      { tag: "h1", role: "heading", text: "Review and repair AI-generated interfaces before they ship" },
      { tag: "h4", role: "heading", text: "Advanced analysis" }
    ],
    buttons: [
      { tag: "a", role: "button", text: "Learn more", href: "#one" },
      { tag: "a", role: "button", text: "Learn more", href: "#two" },
      { tag: "a", role: "button", text: "Learn more", href: "#three" }
    ]
  });
  const report = review(rendered);
  assert.ok(hasIssue(report.top_issues, "information_hierarchy", /heading level/i), "skipped heading levels should be flagged");
  assert.ok(hasIssue(report.top_issues, "task_flow", /vague repeated action/i), "repeated vague action labels should be flagged");
}

{
  const rendered = baseRendered({
    forms: [
      { tag: "form", role: "form", text: "Signup" },
      { tag: "input", role: "form", text: "Email" },
      { tag: "input", role: "form", text: "Company" },
      { tag: "select", role: "form", text: "Plan" }
    ],
    buttons: [{ tag: "button", role: "button", text: "Submit" }],
    text_sample: "Signup Email Company Plan Submit"
  });
  const report = review(rendered);
  assert.ok(
    hasIssue(report.top_issues, "state_completeness", /feedback|validation|error/i),
    "forms without explicit feedback/validation/recovery states should be flagged"
  );
}

{
  const rendered = baseRendered({
    viewports: [
      {
        ...baseRendered().viewports[0],
        layout_metrics: {
          ...baseRendered().viewports[0].layout_metrics!,
          misaligned_section_heading_count: 1,
          cramped_peer_card_count: 1
        }
      },
      baseRendered().viewports[1]
    ]
  });
  const report = review(rendered);
  assert.ok(hasIssue(report.top_issues, "visual_hierarchy", /off-center/i), "large off-center section headings should be flagged");
  assert.ok(hasIssue(report.top_issues, "visual_hierarchy", /cramped peer card/i), "cramped peer cards in one hierarchy layer should be flagged");
}

{
  const rendered = baseRendered({
    viewports: [
      {
        ...baseRendered().viewports[0],
        layout_metrics: {
          ...baseRendered().viewports[0].layout_metrics!,
          unsafe_translucent_overlay_count: 1
        }
      },
      baseRendered().viewports[1]
    ]
  });
  const report = review(rendered);
  assert.ok(hasIssue(report.top_issues, "accessibility", /translucent overlay/i), "unsafe transparent sticky overlays should be flagged");
}

{
  const rendered = baseRendered({
    viewports: [
      {
        ...baseRendered().viewports[0],
        layout_metrics: {
          ...baseRendered().viewports[0].layout_metrics!,
          peer_card_imbalance_count: 1
        }
      },
      baseRendered().viewports[1]
    ]
  });
  const report = review(rendered);
  assert.ok(hasIssue(report.top_issues, "visual_hierarchy", /imbalanced peer-card group/i), "imbalanced subscription/plan card groups should be flagged even without text overflow");
}

{
  const rendered = baseRendered({
    viewports: [
      {
        ...baseRendered().viewports[0],
        layout_metrics: {
          ...baseRendered().viewports[0].layout_metrics!,
          weak_primary_card_text_count: 3,
          over_carded_section_count: 1,
          tight_block_spacing_count: 1
        }
      },
      baseRendered().viewports[1]
    ]
  });
  const report = review(rendered);
  assert.ok(hasIssue(report.top_issues, "visual_hierarchy", /muted gray/i), "card labels that read as border/background weight should be flagged");
  assert.ok(hasIssue(report.top_issues, "content_density", /card grid is followed by additional card-like callouts/i), "card-soup sections should be flagged");
  assert.ok(hasIssue(report.top_issues, "content_density", /panel-to-text gaps/i), "tight panel/code block to follow-up text spacing should be flagged");
}

{
  const rendered = baseRendered({
    viewports: [
      {
        ...baseRendered().viewports[0],
        layout_metrics: {
          ...baseRendered().viewports[0].layout_metrics!,
          above_fold_action_count: 4,
          crowded_region_count: 2
        }
      },
      {
        ...baseRendered().viewports[1],
        layout_metrics: {
          ...baseRendered().viewports[1].layout_metrics!,
          crowded_region_count: 1
        }
      }
    ]
  });
  const simpleReport = reviewUiUrl(
    {
      url: rendered.final_url,
      goal: "Review and repair an AI-generated product page before it ships to customers.",
      audience: "AI builders and founders shipping frontend experiments",
      viewport: ["desktop", "mobile"],
      strictness: "high",
      taste_profile: "simplicity"
    },
    rendered
  );
  const complexReport = reviewUiUrl(
    {
      url: rendered.final_url,
      goal: "Review and repair an AI-generated product page before it ships to customers.",
      audience: "AI builders and founders shipping frontend experiments",
      viewport: ["desktop", "mobile"],
      strictness: "high",
      taste_profile: "complexity"
    },
    rendered
  );
  assert.ok(hasIssue(simpleReport.top_issues, "task_flow", /simplicity profile limit/), "simplicity profile should be stricter about above-fold actions");
  assert.ok(hasIssue(simpleReport.top_issues, "content_density", /simplicity taste profile/), "simplicity profile should be stricter about crowded regions");
  assert.ok(!hasIssue(complexReport.top_issues, "task_flow", /complexity profile limit/), "complexity profile should allow more above-fold actions when structured");
  assert.ok(complexReport.assumptions.some((entry) => entry.includes("Preference profile: complexity")), "reports should expose the active taste profile");
}

{
  const rendered = baseRendered({
    headings: [
      { tag: "h1", role: "heading", text: "Review and repair AI-generated interfaces before they ship" },
      { tag: "h2", role: "heading", text: "Features" },
      { tag: "h2", role: "heading", text: "Pricing" },
      { tag: "h2", role: "heading", text: "FAQ" }
    ],
    text_sample: "Supercharge your workflow — streamline everything — empower teams — unlock next-generation value. Not a tool. A platform. ".repeat(8),
    viewports: [
      {
        ...baseRendered().viewports[0],
        layout_metrics: {
          ...baseRendered().viewports[0].layout_metrics!,
          unique_font_family_count: 1,
          dominant_font_family: "inter",
          gradient_text_count: 1,
          side_accent_card_count: 1,
          nested_card_depth: 3
        }
      },
      baseRendered().viewports[1]
    ]
  });
  const report = review(rendered);
  assert.ok(hasIssue(report.top_issues, "intent_fit", /generic high-gloss marketing/i), "generic marketing slop copy should be flagged");
  assert.ok(hasIssue(report.top_issues, "content_density", /em dashes|manufactured-contrast/i), "AI cadence copy should be flagged");
  assert.ok(hasIssue(report.top_issues, "visual_hierarchy", /gradient text/i), "decorative gradient text should be flagged");
  assert.ok(hasIssue(report.top_issues, "visual_hierarchy", /one-sided accent border/i), "side-accent rounded cards should be flagged");
  assert.ok(hasIssue(report.top_issues, "content_density", /nested card/i), "deeply nested cards should be flagged");
  assert.ok(hasIssue(report.top_issues, "visual_hierarchy", /one dominant font family/i), "single-font content-heavy pages should be flagged");
}

console.log("reviewer-core principle tests passed");
