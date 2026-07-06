# 009: One-shot demo pipeline

## Question

Can the UI Reviewer product run the full local demo pipeline from one command?

Target flow:

```txt
reset flawed fixtures -> baseline eval -> Codex MCP screenshot repair -> after eval -> demo report -> build
```

## Why

Earlier spikes proved the individual pieces:

- MCP/API review works.
- Codex can inspect MCP-returned screenshots and repair fixtures.
- `review_ui_diff` can produce before/after scorecards.
- A Markdown/HTML report can be generated from saved eval summaries.

For demos, the sequence should be reproducible from one command, not a hand-run checklist.

## Implementation

Added bad fixture seeds:

```txt
examples/eval-fixtures-seed/landing-chaos/index.html
examples/eval-fixtures-seed/dashboard-density/index.html
examples/eval-fixtures-seed/onboarding-form/index.html
```

Added reset script:

```txt
scripts/reset-eval-fixtures.mjs
```

Added one-shot pipeline:

```txt
scripts/run-demo-pipeline.mjs
```

Added scripts:

```json
{
  "eval:reset": "node scripts/reset-eval-fixtures.mjs",
  "demo:pipeline": "node scripts/run-demo-pipeline.mjs"
}
```

The pipeline:

1. copies `examples/eval-fixtures-seed` into `examples/eval-fixtures`,
2. runs `npm run typecheck`,
3. runs baseline eval with safe ports,
4. starts a static fixture server for Codex repair,
5. runs `codex exec` with `HOME=/home/nxank4` and the MCP screenshot-repair prompt,
6. saves Codex output to `reports/demo/one-shot-codex-repair.log`,
7. runs after eval and diff scorecards,
8. runs `npm run demo:report`,
9. runs `npm run build`.

## Commands

Dry orchestration test without invoking Codex:

```bash
unset OPENAI_API_KEY
npm run typecheck && SKIP_CODEX_REPAIR=1 npm run demo:pipeline
```

Full one-shot pipeline:

```bash
unset OPENAI_API_KEY
npm run demo:pipeline
```

## Evidence: dry orchestration

The dry run completed and proved reset/baseline/after/report/build orchestration. Because Codex repair was intentionally skipped, the after metrics stayed unchanged:

```json
{
  "average_score_before": 39,
  "average_score_after": 39,
  "score_delta": 0,
  "total_issues_before": 11,
  "total_issues_after": 11,
  "high_severity_before": 9,
  "high_severity_after": 9,
  "fixtures_improved": "0/3"
}
```

## Evidence: full pipeline

The full pipeline completed with Codex repair enabled:

```json
{
  "status": "completed",
  "reset_fixtures": true,
  "codex_repair": {
    "skipped": false,
    "log_path": "reports/demo/one-shot-codex-repair.log"
  }
}
```

Baseline eval:

```json
{
  "average_score": 39,
  "total_issues": 11,
  "high_severity_issues": 9
}
```

After eval:

```json
{
  "average_score": 100,
  "total_issues": 0,
  "high_severity_issues": 0
}
```

Diffs:

```txt
landing-chaos:      +54 score, -3 issues, -3 high severity
 dashboard-density: +64 score, -4 issues, -3 high severity
 onboarding-form:   +64 score, -4 issues, -3 high severity
```

Demo report output:

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

## Validation

The full pipeline itself ran:

```txt
npm run typecheck
npm run build
```

Final manual verification also passed:

```bash
npm run typecheck
npm run build
```

## Verdict: VALIDATED

The local product demo is now reproducible with:

```bash
npm run demo:pipeline
```

The command resets bad fixtures, generates baseline evidence, uses Codex/MCP screenshots to repair the UIs, reruns eval, generates a demo report, and verifies the build.

## Notes

- The one-shot path uses Codex browser/link login via `HOME=/home/nxank4`, not a server-side `OPENAI_API_KEY`.
- `reports/` remains gitignored. Demo reports and Codex repair logs are local artifacts.
- `SKIP_CODEX_REPAIR=1` is useful for testing the orchestration without spending model time.

## Next product step

Now that the local demo is reproducible, the next useful step is **positioning and packaging**:

1. write a short product one-pager/landing copy from the generated report,
2. define the first buyer segment,
3. choose a small paid pilot offer,
4. avoid auth/billing/dashboard until at least one external user wants to try it.
