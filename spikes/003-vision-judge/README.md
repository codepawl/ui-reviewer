# 003: Vision judge layer

## Question

Given rendered desktop/mobile screenshots and DOM context, when `review_ui_url` is called with `use_vision=true` or `return_images=true`, then the MCP server can support visual UI review in two modes:

1. server-side model judging through a product API key, and
2. host-agent judging where Codex receives MCP image content and critiques screenshots with its own logged-in model session.

## Risk

DOM heuristics catch obvious structure problems but miss visual problems: weak hierarchy, cramped layout, broken mobile composition, misleading emphasis, and general “looks okay but feels wrong” UI. Without a visual review path, the product is closer to a linter than a UI/UX reviewer.

## Implementation

Added:

```txt
packages/vision-adapter/src/index.ts
```

The server-side adapter:

- reads captured screenshot files
- sends desktop/mobile screenshots plus DOM context to OpenAI Responses API when `OPENAI_API_KEY` is configured
- requests strict JSON with `score_delta`, `summary`, and `issues[]`
- normalizes vision issues into the same `ReviewIssue` schema used by DOM heuristics
- returns an explicit fallback when no valid API key is configured

MCP input now supports:

```json
{
  "use_vision": true,
  "vision_model": "gpt-4o-mini",
  "return_images": true
}
```

`return_images=true` attaches the captured screenshots as MCP image content. This lets Codex/Claude inspect the images with the host model session, without requiring the MCP server to have an `OPENAI_API_KEY`.

Combined report includes:

```json
{
  "product_stage": "spike-003-vision-judge",
  "vision_review": {
    "enabled": false,
    "provider": "fallback",
    "model": "not-configured",
    "score_delta": 0,
    "summary": "..."
  }
}
```

## Evidence

Fallback path works with real screenshots and DOM evidence:

```txt
unset OPENAI_API_KEY
TEST_URL=http://127.0.0.1:4173 npm run smoke:vision
# VISION_KEY_CONFIGURED=false
# product_stage: spike-003-vision-judge
# score: 82
# vision_review.enabled: false
# vision_review.provider: fallback
# screenshots: desktop + mobile
```

Codex can call the MCP vision path:

```txt
unset OPENAI_API_KEY
HOME=/home/nxank4 codex exec --sandbox workspace-write --cd /home/nxank4/Code/hermes/codepawl/ui-reviewer "Use the ui-reviewer MCP server to call review_ui_url ... use_vision true"
# mcp: ui-reviewer/review_ui_url (completed)
# product_stage: spike-003-vision-judge
# score: 82
# vision: enabled=false, model=not-configured, provider=fallback
# first_issue_category: task_flow
```

Codex can also receive MCP image content and critique screenshots using its own browser/link login session:

```txt
HOME=/home/nxank4 codex exec --sandbox workspace-write --cd /home/nxank4/Code/hermes/codepawl/ui-reviewer "Use the ui-reviewer MCP server to call review_ui_url ... use_vision false, return_images true. Inspect the attached screenshots yourself..."
# mcp: ui-reviewer/review_ui_url (completed)
# Yes. The MCP response attached two visible screenshots: desktop and mobile.
# Visual UX issue: the mobile layout horizontally overflows the viewport...
# Deterministic first issue category: task_flow.
```

Attempted to use the ChatGPT/Codex OAuth access token as an API bearer token for OpenAI Responses. The request reached OpenAI but failed with missing API scope:

```txt
OpenAI vision request failed 401: insufficient permissions; missing scopes: api.responses.write
```

This proves the HTTP path is wired, but the available Codex login token is not a usable OpenAI API key for this product server-side call. It is still usable through the host-agent image path because Codex itself receives and reasons over the MCP image content.

Validation:

```txt
npm run typecheck
# passed
npm run build
# passed
```

## Verdict: VALIDATED for Codex demo, PARTIAL for server-side API vision

The Codex product demo path is validated:

- MCP accepts `return_images=true`
- screenshots are attached as MCP image content
- Codex sees desktop/mobile screenshots using its existing login session
- Codex can produce a visual UX issue from screenshot evidence
- no `OPENAI_API_KEY` is required for the local Codex demo path

The server-side product API path is partial:

- MCP accepts `use_vision=true`
- screenshots are prepared for multimodal review
- OpenAI Responses request path is implemented
- vision issues merge into the normal review schema
- fallback behavior is explicit and safe when no API key is available
- a real OpenAI API key with `responses.write` scope is still needed to validate server-side model-generated visual critique

## Recommendation for the real build

For local Codex demos, use:

```json
{
  "use_vision": false,
  "return_images": true
}
```

For hosted/API product mode, use:

```json
{
  "use_vision": true,
  "return_images": false
}
```

Spike 004 should close the repair loop: Codex receives the structured report plus screenshots, applies the `repair_prompt`, reviewer re-runs, and we measure before/after score and issue reduction.
