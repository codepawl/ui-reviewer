# 007: Eval fixture pack

## Question

Can the UI Reviewer product loop generalize beyond one toy landing page and produce measurable repair improvements across multiple realistic AI-generated frontend failure modes?

## Fixture pack

Added three deliberately flawed UI fixtures:

```txt
examples/eval-fixtures/landing-chaos/index.html
examples/eval-fixtures/dashboard-density/index.html
examples/eval-fixtures/onboarding-form/index.html
```

Failure modes:

1. **landing-chaos** — vague H1, competing CTAs, fixed-width mobile overflow.
2. **dashboard-density** — dense dashboard, too many nav/action items, unclear primary workflow, mobile overflow.
3. **onboarding-form** — dumped form fields, unclear progress/state, competing actions, fixed mobile width.

## Product changes

Extended renderer evidence:

```txt
RenderedViewport.document_scroll_width
RenderedViewport.body_scroll_width
```

Extended deterministic review heuristics:

- mobile horizontal overflow detection,
- dense navigation / weak heading structure,
- form/state-completeness warning,
- better button/anchor/form-control extraction.

Added eval runner:

```txt
scripts/eval-fixtures.mjs
```

Added npm script:

```bash
npm run eval:fixtures
```

The runner:

1. starts a static fixture server,
2. starts the API server,
3. reviews every fixture via `POST /v1/reviews/url`,
4. saves per-fixture reports under `reports/evals/spike-007/`,
5. optionally compares against baseline when `EVAL_PHASE` is not `baseline`.

## Baseline evidence

Command:

```bash
unset OPENAI_API_KEY
API_PORT=4318 FIXTURE_PORT=4188 EVAL_PHASE=baseline npm run eval:fixtures
```

Result:

```json
{
  "phase": "baseline",
  "fixture_count": 3,
  "average_score": 39,
  "total_issues": 11,
  "high_severity_issues": 9,
  "fixtures": [
    {
      "id": "landing-chaos",
      "score": 46,
      "issue_count": 3,
      "high_severity_issues": 3,
      "categories": ["intent_fit", "task_flow", "responsive"]
    },
    {
      "id": "dashboard-density",
      "score": 36,
      "issue_count": 4,
      "high_severity_issues": 3,
      "categories": ["intent_fit", "task_flow", "information_hierarchy", "responsive"]
    },
    {
      "id": "onboarding-form",
      "score": 36,
      "issue_count": 4,
      "high_severity_issues": 3,
      "categories": ["intent_fit", "task_flow", "state_completeness", "responsive"]
    }
  ]
}
```

Saved reports:

```txt
reports/evals/spike-007/baseline-landing-chaos.json
reports/evals/spike-007/baseline-dashboard-density.json
reports/evals/spike-007/baseline-onboarding-form.json
reports/evals/spike-007/baseline-summary.json
```

## Repair loop

Codex used `ui-reviewer/review_ui_url` with:

```json
{
  "viewport": ["desktop", "mobile"],
  "strictness": "high",
  "return_images": true,
  "use_vision": false
}
```

Codex inspected MCP-returned desktop/mobile screenshots and edited only:

```txt
examples/eval-fixtures/landing-chaos/index.html
examples/eval-fixtures/dashboard-density/index.html
examples/eval-fixtures/onboarding-form/index.html
```

Repair summary:

- **landing-chaos**: replaced vague hero/copy, reduced to one primary CTA, converted secondary action to text link, made hero/plans collapse to one column on mobile.
- **dashboard-density**: reduced sidebar/action clutter, centered the screen around at-risk trial accounts, kept one primary action, made the table responsive as mobile cards.
- **onboarding-form**: added step/state structure, grouped required fields/settings, removed competing submit buttons, removed fixed mobile width.

## After evidence

Command:

```bash
unset OPENAI_API_KEY
API_PORT=4322 FIXTURE_PORT=5179 EVAL_PHASE=after npm run eval:fixtures
```

Result:

```json
{
  "phase": "after",
  "fixture_count": 3,
  "average_score": 100,
  "total_issues": 0,
  "high_severity_issues": 0,
  "fixtures": [
    { "id": "landing-chaos", "score": 100, "issue_count": 0, "high_severity_issues": 0 },
    { "id": "dashboard-density", "score": 100, "issue_count": 0, "high_severity_issues": 0 },
    { "id": "onboarding-form", "score": 100, "issue_count": 0, "high_severity_issues": 0 }
  ],
  "diffs": [
    {
      "label": "landing-chaos-after",
      "verdict": "improved",
      "score_delta": 54,
      "issue_count_delta": -3,
      "high_severity_delta": -3,
      "fixed_issue_categories": ["intent_fit", "responsive", "task_flow"]
    },
    {
      "label": "dashboard-density-after",
      "verdict": "improved",
      "score_delta": 64,
      "issue_count_delta": -4,
      "high_severity_delta": -3,
      "fixed_issue_categories": ["information_hierarchy", "intent_fit", "responsive", "task_flow"]
    },
    {
      "label": "onboarding-form-after",
      "verdict": "improved",
      "score_delta": 64,
      "issue_count_delta": -4,
      "high_severity_delta": -3,
      "fixed_issue_categories": ["intent_fit", "responsive", "state_completeness", "task_flow"]
    }
  ]
}
```

Saved reports:

```txt
reports/evals/spike-007/after-landing-chaos.json
reports/evals/spike-007/after-dashboard-density.json
reports/evals/spike-007/after-onboarding-form.json
reports/evals/spike-007/after-summary.json
```

## Validation

```bash
npm run typecheck
npm run build
```

Status: passed.

## Verdict: VALIDATED

The product loop now works across 3 different AI-generated frontend failure modes:

```txt
review fixture pack -> Codex screenshot-aware repair -> rerun eval -> diff scorecards
```

Aggregate improvement:

```txt
average score: 39 -> 100
total issues: 11 -> 0
high-severity issues: 9 -> 0
fixtures improved: 3/3
```

## Notes

- A trial run used `FIXTURE_PORT=4190`, which Node/undici rejects as a restricted/bad port. The eval runner default was changed to `5179`.
- The eval runner starts `tsx apps/api/src/index.ts` directly instead of `npm run api` so cleanup does not leave an orphan API process.

## Next product step

Create a tiny demo report generator that turns `baseline-summary.json` and `after-summary.json` into a founder/customer-facing Markdown or HTML page:

```txt
Problem -> screenshots/reports -> Codex repair -> measurable score lift
```

This becomes the first sales/demo artifact without adding a dashboard yet.
