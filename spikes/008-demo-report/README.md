# 008: Demo report generator

## Question

Can the UI Reviewer product turn the validated eval fixture results into a customer/founder-facing demo artifact without adding a dashboard?

## Why

The product loop is validated technically:

```txt
review fixture pack -> Codex screenshot-aware repair -> rerun eval -> diff scorecards
```

But a product demo needs a concise artifact that explains:

- the problem,
- the before/after scorecard,
- the categories fixed,
- why MCP/API review is different from generic screenshot critique.

## Implementation

Added:

```txt
scripts/generate-demo-report.mjs
```

Added script:

```bash
npm run demo:report
```

Inputs:

```txt
reports/evals/spike-007/baseline-summary.json
reports/evals/spike-007/after-summary.json
```

Outputs:

```txt
reports/demo/spike-007-report.md
reports/demo/spike-007-report.html
```

The generated report is intentionally stored under `reports/`, which is gitignored. It is a reproducible local demo artifact, not committed product state.

## Evidence

Command:

```bash
npm run demo:report
```

Result:

```json
{
  "markdown_path": "reports/demo/spike-007-report.md",
  "html_path": "reports/demo/spike-007-report.html",
  "average_score_before": 39,
  "average_score_after": 100,
  "score_delta": 61,
  "total_issues_before": 11,
  "total_issues_after": 0,
  "high_severity_before": 9,
  "high_severity_after": 0,
  "fixtures_improved": "3/3"
}
```

Generated Markdown summary:

```txt
UI Reviewer found major UX/layout failures in three AI-generated frontend fixtures, Codex repaired them using MCP screenshots and structured issues, and the eval score improved from 39 to 100.
```

Generated aggregate scorecard:

```txt
Average score: 39 -> 100 (+61)
Total issues: 11 -> 0 (-11)
High-severity issues: 9 -> 0 (-9)
Fixtures improved: 0/3 -> 3/3 (+3)
```

Generated per-fixture rows:

```txt
Landing Chaos: 46 -> 100, fixed intent_fit/responsive/task_flow
Dashboard Density: 36 -> 100, fixed information_hierarchy/intent_fit/responsive/task_flow
Onboarding Form: 36 -> 100, fixed intent_fit/responsive/state_completeness/task_flow
```

HTML sanity check:

```txt
exists: true
bytes: 4132
checks: <html, Average score, 39, 100, Fixtures improved all present
```

## Validation

```bash
npm run typecheck
npm run build
```

Status: passed.

## Verdict: VALIDATED

The product now has a reproducible demo artifact:

```txt
reports/demo/spike-007-report.md
reports/demo/spike-007-report.html
```

This is enough for a first lightweight product demo without building a dashboard.

## Next product step

Build a tiny demo command or one-shot script that runs the full pipeline from scratch:

```txt
baseline eval -> Codex repair prompt instructions -> after eval -> demo report
```

For now the pipeline is documented and reproducible, but still split across commands and a Codex exec prompt. The next improvement is orchestration, not UI.
