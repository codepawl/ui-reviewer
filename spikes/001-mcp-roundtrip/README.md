# 001: MCP roundtrip with Codex

## Question

Given a local UXRay MCP server, when Codex is configured with it, then Codex can call `review_ui_url` and receive structured UI/UX review JSON.

## Risk

If Codex cannot reliably call a local MCP server, the product needs to start as a CLI/API first instead of an agent-native MCP integration.

## Evidence

Local MCP server works via the official MCP SDK client:

```txt
npm run typecheck
# passed

npm run smoke:mcp
# TOOLS health_check,review_ui_url
# health_check returned ok=true
# review_ui_url returned score=82 and verdict="usable MCP context, needs rendered review"

npm run build
# passed
```

Codex registration works in both the Hermes-profile Codex home and An's real Codex home:

```txt
codex mcp add ui-reviewer -- npm --prefix /home/nxank4/Code/hermes/codepawl/ui-reviewer run mcp
# Added global MCP server 'ui-reviewer'.

HOME=/home/nxank4 codex mcp add ui-reviewer -- npm --prefix /home/nxank4/Code/hermes/codepawl/ui-reviewer run mcp
# Added global MCP server 'ui-reviewer'.
```

Codex agent-to-MCP roundtrip is validated using An's real Codex home/auth:

```txt
HOME=/home/nxank4 codex login status
# Logged in using ChatGPT

HOME=/home/nxank4 codex exec --sandbox read-only --cd /home/nxank4/Code/hermes/codepawl/ui-reviewer "Use the ui-reviewer MCP server..."
# mcp: ui-reviewer/health_check started
# mcp: ui-reviewer/health_check (completed)
# mcp: ui-reviewer/review_ui_url started
# mcp: ui-reviewer/review_ui_url (completed)
# score: 82
# verdict: usable MCP context, needs rendered review
```

## Verdict: VALIDATED

Codex can call the local UI Reviewer MCP server and receive a structured UX review report.

## What worked

- Product-shaped repo skeleton under `apps/` and `packages/`.
- `health_check` MCP tool.
- `review_ui_url` MCP tool with structured report schema.
- Official MCP SDK smoke client can list and call tools.
- Codex accepts the server config.
- Codex agent successfully calls both MCP tools and returns the report fields.

## What didn't

- The Hermes tool shell uses a profile-local HOME by default, where Codex auth is separate. For real Codex auth/config, run Codex with `HOME=/home/nxank4` in this Hermes session.

## Recommendation for the real build

Start Spike 002: Playwright renderer + DOM/text extraction. The MCP integration path is clear.
