# 002: Playwright render and DOM capture

## Question

Given a URL, when the UI Reviewer MCP tool runs, then it can render desktop/mobile views, save screenshots, extract DOM context, and return that evidence in the review report.

## Risk

Without real browser evidence, the product is only a prompt wrapper. The reviewer must inspect rendered output to catch the actual failure mode: AI-generated UI that looks okay in code but fails in layout, hierarchy, mobile, or density.

## Evidence

Implemented `packages/renderer` with Playwright Core using the system Chrome binary at `/usr/bin/google-chrome`.

Created an intentionally weak example landing page:

```txt
examples/bad-landing/index.html
```

Smoke-tested against a local static server:

```txt
python3 -m http.server 4173 --bind 127.0.0.1 --directory examples/bad-landing
TEST_URL=http://127.0.0.1:4173 npm run smoke:render
```

Observed output:

```json
{
  "product_stage": "spike-002-render-dom-capture",
  "score": 82,
  "verdict": "usable but has UX issues to repair",
  "rendered_context": {
    "title": "Bad UI Reviewer Landing",
    "screenshots": ["desktop", "mobile"],
    "headings": ["Make interfaces better and review things with AI very quickly", "Everything it can do", "Free", "Pro", "Team"],
    "buttons": ["Upload screenshot", "Install MCP", "Try", "Try", "Contact"]
  },
  "top_issues": [
    {
      "severity": "high",
      "category": "task_flow",
      "evidence": "Rendered DOM exposes 5 button-like actions near the page, which likely creates competing CTAs."
    }
  ]
}
```

Codex agent-to-MCP-to-renderer roundtrip is also validated:

```txt
HOME=/home/nxank4 codex exec --sandbox workspace-write --cd /home/nxank4/Code/hermes/codepawl/ui-reviewer "Use the ui-reviewer MCP server to call review_ui_url on http://127.0.0.1:4173 ..."
# mcp: ui-reviewer/review_ui_url (completed)
# product_stage: spike-002-render-dom-capture
# score: 82
# screenshot_count: 2
# first_issue_category: task_flow
```

Validation:

```txt
npm run typecheck
# passed
npm run build
# passed
```

## Verdict: VALIDATED

The MCP tool now performs a real browser render, captures desktop/mobile screenshots, extracts DOM summaries, and returns that evidence in the same structured review schema Codex can consume.

## What worked

- Playwright Core can launch system Chrome headlessly.
- Desktop and mobile screenshots are saved under `reports/screenshots/`.
- DOM extraction returns title, headings, buttons, links, forms, and visible text sample.
- `review_ui_url` now produces a rendered-context report instead of a pure mock report.
- Codex can call the tool and receive screenshot count + issue category from rendered evidence.

## What didn't

- A first attempt with `page.evaluate(() => ...)` failed because the TS/tsx transform injected an unavailable `__name` helper into browser context. Switching to a string-evaluated browser function fixed it.
- Current review logic is still deterministic/heuristic. It catches obvious CTA/task-flow issues but does not yet visually inspect screenshots.

## Recommendation for the real build

Start Spike 003: add a vision LLM judge over the captured screenshots and compare its critique against the deterministic DOM heuristic report.
