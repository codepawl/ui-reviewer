# UXRay Agent Skill

Use UXRay whenever you are asked to review, repair, or improve an AI-generated frontend.

## When to call UXRay

- Before shipping a generated landing page, dashboard, onboarding flow, settings page, or pricing page.
- When the UI looks pretty but the user intent, task flow, responsive behavior, or content density feels wrong.
- After editing the UI, to measure whether the repair actually improved the score.

## Required loop

1. Call `health_check` first.
2. Call `review_ui_url` with the local URL and `return_images=true`.
3. Read the structured issues, viewport layout metrics, and `repair_plan`; inspect the screenshots.
4. Fix only UI files relevant to the reported repair_plan steps.
5. Call `review_ui_url` again.
6. Call `review_ui_diff` to compare before/after.
7. Report score delta, fixed categories, and remaining blockers.

## Repair discipline

- Do not blindly beautify the page.
- Preserve the product intent.
- Prefer fewer CTAs, clearer hierarchy, stronger empty states, and mobile-safe layouts.
- Treat high-severity issues as blockers and use `repair_plan.acceptance_checks` as the verification contract.
- Avoid adding dense cards, decorative stats, fake testimonials, or generic SaaS filler.

## Advanced review passes

Use these passes when quality matters more than speed:

1. **Evidence pass** — trust screenshots, DOM text, layout metrics, headings, controls, form counts, overflow, and before/after diff data before subjective taste.
2. **Heuristic pass** — map issues to Nielsen-style usability principles: system status, match to real-world language, user control, consistency, error prevention, recognition over recall, efficiency, minimalist design, error recovery, and help/documentation.
3. **Taste pass** — ask a visual model or design reviewer to judge hierarchy, spacing rhythm, density, contrast, visual noise, brand fit, and whether the UI feels like a real product instead of AI filler.
4. **Pairwise pass** — compare before vs after screenshots directly. The after version must be clearer for the same user task, not merely prettier.
5. **Regression pass** — rerun UXRay after edits and block release if score drops, high-severity issues remain, mobile overflows, or the main CTA/task becomes less obvious.

Model-council rule: if using multiple models, give each model a narrow role. Example: one fast model for DOM/heuristics, one stronger vision model for screenshot taste, and one final pairwise judge for before/after. Do not average vague opinions; merge only evidence-backed findings.

## Good prompt

```txt
Use UXRay to review this local frontend URL.
Inspect screenshots and structured issues.
Fix only the UI/UX problems UXRay reports.
Rerun UXRay and summarize the before/after score delta.
```
