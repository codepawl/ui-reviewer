# 005: Review diff scorecard

## Question

Given two `review_ui_url` reports, can the MCP server produce a clean before/after repair-loop scorecard for Codex, CI, and future API consumers?

## Why

The repair loop became compelling in Spike 004, but the comparison was still manual. A product needs a stable diff contract so an agent or CI job can answer:

- did the repair improve the UI?
- did high-severity issue count drop?
- which issue categories were fixed, introduced, or still present?
- should Codex keep repairing, revert, or accept this as the new baseline?

## Implementation

Added core function:

```txt
packages/reviewer-core/src/index.ts
compareReviewReports(before, after)
```

Added MCP tool:

```txt
review_ui_diff
```

Input:

```json
{
  "before_report_path": "reports/reviews/before.json",
  "after_report_path": "reports/reviews/after.json",
  "label": "repair-loop"
}
```

Output shape:

```json
{
  "product_stage": "spike-005-review-diff",
  "verdict": "improved",
  "score_before": 82,
  "score_after": 100,
  "score_delta": 18,
  "issue_count_before": 1,
  "issue_count_after": 0,
  "high_severity_before": 1,
  "high_severity_after": 0,
  "fixed_issue_categories": ["task_flow"],
  "introduced_issue_categories": [],
  "remaining_issue_categories": [],
  "codex_next_action": "Keep the repair and use the after report as the new baseline."
}
```

Added smoke script:

```txt
scripts/review-diff.mjs
npm run review:diff
```

## Evidence

SDK smoke path:

```bash
unset OPENAI_API_KEY
npm run typecheck && npm run review:diff
```

Result:

```json
{
  "product_stage": "spike-005-review-diff",
  "verdict": "improved",
  "score_before": 82,
  "score_after": 100,
  "score_delta": 18,
  "issue_count_before": 1,
  "issue_count_after": 0,
  "issue_count_delta": -1,
  "high_severity_before": 1,
  "high_severity_after": 0,
  "high_severity_delta": -1,
  "fixed_issue_categories": ["task_flow"],
  "introduced_issue_categories": [],
  "remaining_issue_categories": [],
  "summary": "Repair loop improved the UI review score by 18 points and reduced high-severity issues from 1 to 0.",
  "codex_next_action": "Keep the repair and use the after report as the new baseline."
}
```

Codex MCP path:

```bash
unset OPENAI_API_KEY
HOME=/home/nxank4 codex exec --sandbox read-only --cd /home/nxank4/Code/hermes/codepawl/ui-reviewer \
  "Use the ui-reviewer MCP server to call review_ui_diff with before_report_path='reports/reviews/before.json', after_report_path='reports/reviews/after.json', label='repair-loop'. Return only product_stage, verdict, score_delta, high_severity_delta, fixed_issue_categories, and codex_next_action."
```

Result:

```json
{
  "product_stage": "spike-005-review-diff",
  "verdict": "improved",
  "score_delta": 18,
  "high_severity_delta": -1,
  "fixed_issue_categories": ["task_flow"],
  "codex_next_action": "Keep the repair and use the after report as the new baseline."
}
```

Validation:

```txt
npm run typecheck
# passed
npm run build
# passed
```

## Verdict: VALIDATED

The diff tool is now a stable product contract:

```txt
review_ui_url(before) + review_ui_url(after) -> review_ui_diff scorecard
```

This makes the repair loop easy for Codex, CI, and a future API to consume without manually reading full review reports.

## Next product step

Add a thin HTTP API wrapper over the same core contracts:

- `POST /v1/reviews/url`
- `POST /v1/reviews/diff`

Keep auth/billing out until the local demo flow remains stable.
