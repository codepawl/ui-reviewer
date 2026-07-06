# 006: HTTP API wrapper

## Question

Can the UI Reviewer MCP product expose the same core review and diff contracts through a thin HTTP API without adding auth, billing, hosting, or dashboard complexity?

## Why

The MCP repair loop is validated, but a sellable product also needs an API surface for:

- non-Codex agents,
- CI/regression jobs,
- future hosted API demos,
- customers who want to integrate UI review into their own pipelines.

The API should reuse the same core packages as MCP:

```txt
packages/reviewer-core
packages/renderer
packages/vision-adapter
```

## Endpoints

```txt
GET  /health
POST /v1/reviews/url
POST /v1/reviews/diff
```

### `GET /health`

Returns:

```json
{
  "ok": true,
  "service": "ui-reviewer-api",
  "stage": "spike-006-api-wrapper",
  "endpoints": ["GET /health", "POST /v1/reviews/url", "POST /v1/reviews/diff"]
}
```

### `POST /v1/reviews/url`

Input:

```json
{
  "url": "http://127.0.0.1:4173",
  "goal": "Landing page for an MCP UI reviewer that helps coding agents fix AI-generated frontend UX problems",
  "audience": "technical founders and developers using Codex, Lovable, Bolt, and Claude Code",
  "viewport": ["desktop", "mobile"],
  "strictness": "high"
}
```

Output: same report contract as MCP `review_ui_url`.

### `POST /v1/reviews/diff`

Input:

```json
{
  "before": { "...": "review_ui_url report" },
  "after": { "...": "review_ui_url report" },
  "label": "api-smoke"
}
```

Output: same scorecard contract as MCP `review_ui_diff`.

## Implementation

Added API entrypoint:

```txt
apps/api/src/index.ts
```

Added smoke client:

```txt
scripts/smoke-api.mjs
```

Added scripts:

```json
{
  "api": "tsx apps/api/src/index.ts",
  "smoke:api": "node scripts/smoke-api.mjs"
}
```

## Evidence

Started fixture page:

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory examples/bad-landing
```

Started API:

```bash
npm run api
```

Readiness:

```txt
http://127.0.0.1:4173 200
http://127.0.0.1:4317/health 200
```

Smoke command:

```bash
unset OPENAI_API_KEY
TEST_URL=http://127.0.0.1:4173 npm run smoke:api
```

Result:

```txt
HEALTH {"ok":true,"service":"ui-reviewer-api","stage":"spike-006-api-wrapper"}
URL_REVIEW {"score":100,"verdict":"ready for repair-loop validation","issue_count":0,"screenshot_count":2}
DIFF {"verdict":"improved","score_delta":18,"high_severity_delta":-1,"fixed_issue_categories":["task_flow"]}
```

Validation:

```txt
npm run typecheck
# passed
npm run build
# passed
```

## Verdict: VALIDATED

The API wrapper is working and reuses the same core contracts as MCP.

Current product surfaces:

```txt
MCP: health_check, review_ui_url, review_ui_diff
API: GET /health, POST /v1/reviews/url, POST /v1/reviews/diff
```

## Next product step

Build a small fixture/eval pack with three realistic AI-generated frontend failures:

1. landing page with CTA/hierarchy issues,
2. dashboard with density/navigation issues,
3. onboarding/form with state and mobile issues.

Then run the same review/repair/diff loop across all three to produce a stronger demo and product scorecard.
