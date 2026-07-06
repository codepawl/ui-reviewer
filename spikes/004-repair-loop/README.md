# 004: Codex repair loop

## Question

Given a bad UI fixture and the `ui-reviewer` MCP server, can Codex:

1. call `review_ui_url`,
2. receive structured issues plus desktop/mobile screenshots,
3. repair the UI source file,
4. re-run the reviewer, and
5. produce a measurable score/issue improvement?

## Success criteria

- Baseline review returns at least one high-severity issue.
- Codex uses MCP screenshot evidence, not only static source inspection.
- Post-repair review score improves.
- High-severity issue count decreases.
- `npm run typecheck` and `npm run build` pass after the repair.

## Setup

Served the fixture with:

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory examples/bad-landing
```

## Baseline evidence

Command:

```bash
unset OPENAI_API_KEY
REVIEW_LABEL=before TEST_URL=http://127.0.0.1:4173 npm run review:url
```

Result:

```json
{
  "score": 82,
  "verdict": "usable but has UX issues to repair",
  "issue_count": 1,
  "high_issue_count": 1,
  "first_issue_category": "task_flow",
  "first_issue": "Rendered DOM exposes 5 button-like actions near the page, which likely creates competing CTAs.",
  "screenshot_count": 2
}
```

Saved report:

```txt
reports/reviews/before.json
```

## Codex repair command

Used Codex through the browser/link login path, not an API key:

```bash
unset OPENAI_API_KEY
HOME=/home/nxank4 codex exec --sandbox workspace-write --cd /home/nxank4/Code/hermes/codepawl/ui-reviewer \
  "We are validating Spike 004 repair loop for the UI Reviewer MCP product. Use the ui-reviewer MCP server to call review_ui_url on http://127.0.0.1:4173 with goal='Landing page for an MCP UI reviewer that helps coding agents fix AI-generated frontend UX problems', audience='technical founders and developers using Codex, Lovable, Bolt, and Claude Code', viewport desktop and mobile, strictness high, use_vision false, return_images true. Inspect the attached screenshots yourself. Then edit only examples/bad-landing/index.html to fix the high-severity task_flow issue and any obvious visual issue from the screenshots. Requirements: one clear primary CTA above the fold, no more than three button-like actions in rendered DOM, no mobile horizontal overflow, clearer hero value prop, concise scannable sections. Do not commit. After editing, briefly report what you changed."
```

Codex evidence:

```txt
mcp: ui-reviewer/review_ui_url (completed)
The review confirmed the high-severity issue: five competing button-like actions.
The screenshots also show a separate visual defect on mobile: the layout is wider than the viewport, cropping the Pro card and forcing horizontal overflow.
```

Codex edited only:

```txt
examples/bad-landing/index.html
```

## Changes made

- Replaced the competing CTA cluster with one primary above-fold CTA: `Install the MCP server`.
- Rewrote the hero around the MCP repair-loop value prop for coding agents.
- Replaced vague/pricing cards with concise scannable feature cards.
- Collapsed mobile layout to one column and removed the horizontal overflow source.

Relevant file areas:

```txt
examples/bad-landing/index.html:8-28
examples/bad-landing/index.html:35-55
```

## Post-repair evidence

Command:

```bash
unset OPENAI_API_KEY
REVIEW_LABEL=after TEST_URL=http://127.0.0.1:4173 npm run review:url
```

Result:

```json
{
  "score": 100,
  "verdict": "ready for repair-loop validation",
  "issue_count": 0,
  "high_issue_count": 0,
  "first_issue_category": null,
  "screenshot_count": 2
}
```

Saved report:

```txt
reports/reviews/after.json
```

Score comparison:

```json
{
  "before_score": 82,
  "after_score": 100,
  "score_delta": 18,
  "before_issues": 1,
  "after_issues": 0,
  "before_high": 1,
  "after_high": 0
}
```

Mobile overflow check:

```json
{
  "innerWidth": 390,
  "scrollWidth": 390,
  "bodyScrollWidth": 390,
  "h1": "Give coding agents concrete UX repair instructions.",
  "buttons": ["Install the MCP server"]
}
```

## Validation

```txt
npm run typecheck
# passed
npm run build
# passed
```

## Verdict: VALIDATED

The local Codex demo loop works:

```txt
MCP review -> screenshot-aware Codex repair -> rerender/review -> measurable improvement
```

The experiment produced a concrete before/after improvement:

- score: `82 -> 100`
- high-severity issues: `1 -> 0`
- total issues: `1 -> 0`
- mobile overflow: `scrollWidth 390 == innerWidth 390`

This is now a compelling first product demo for the MCP-first UI Reviewer wedge.

## Next product step

Add a dedicated `review_ui_diff` or `repair_loop_summary` tool that compares two review reports and emits a clean before/after scorecard for Codex, CI, or a future API response.
