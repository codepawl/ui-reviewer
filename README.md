# UI Reviewer MCP

MCP-first, API-ready UI/UX review layer for AI-generated frontends.

The first spike validates the Codex integration path:

1. Run a local MCP server.
2. Register it with Codex.
3. Let Codex call `review_ui_url` and receive structured UX repair guidance.

## Current tools

- `health_check` — verifies MCP connectivity.
- `review_ui_url` — renders a URL with Chrome/Playwright, captures desktop/mobile screenshots, extracts DOM and layout metrics, optionally runs a server-side vision judge with `use_vision=true`, optionally returns screenshots to the host agent with `return_images=true`, and returns structured issues plus a concrete `repair_plan` agents can apply.
- `review_ui_diff` — compares two `review_ui_url` JSON reports and returns a before/after repair-loop scorecard.

## Current API endpoints

- `GET /health` — verifies the HTTP API is live.
- `GET /v1/install` — returns Codex, Claude Code, and local API setup snippets for the hosted docs.
- `GET /v1/update` — returns latest UXRay version, release notes, and local check/upgrade commands.
- `GET /v1/demo/report` — returns the static demo scorecard used by the landing page.
- `GET|POST /v1/billing/checkout` — creates a Creem checkout session for `plan=pro|team|credits`, with direct product-link fallback.
- `POST /v1/reviews/url` — API equivalent of `review_ui_url`; hosted mode stores report JSON/screenshots and returns `report_id`, `report_url`, and `share_url`.
- `GET /v1/reports/:id` — returns a saved hosted review report from R2.
- `GET /r/:id` — public share page for a saved hosted review report.
- `GET /v1/reports/:id/screenshots/:file` — serves persisted screenshots from R2.
- `POST /v1/reviews/diff` — API equivalent of `review_ui_diff`.

## Hosted Cloudflare demo

```txt
https://useuxray.com/
https://useuxray.com/docs.html
https://useuxray.com/demo-report.html
https://useuxray.com/login.html
https://useuxray.com/signup.html
https://useuxray.com/checkout.html
https://useuxray.com/account.html
https://useuxray.com/v1/install
https://useuxray.com/v1/update
https://useuxray.com/v1/billing/checkout
https://useuxray.com/v1/demo/report
https://useuxray.com/r/:report_id
https://useuxray.com/plugins/uxray-agent-skill.md
```

The Cloudflare site hosts the landing page, install docs, before/after demo visuals, pricing/account shell, UXRay agent skill, and public API surface. Full URL rendering runs through local MCP/Playwright or a browser-capable Node render worker. In production, Cloudflare remains the control plane and proxies `/v1/reviews/url` to the Fly.io render worker when `RENDER_API_BASE` is configured, because standard Workers should not launch Chrome. Saved hosted reports use Cloudflare D1 (`uxray-reports`) for metadata and R2 (`uxray-reports`) for report JSON plus screenshot PNGs.

The current review contract includes `top_issues`, viewport `layout_metrics`, and a `repair_plan` with region, selector hints, change intent, constraints, acceptance checks, and regression risks. This makes the output more useful as an agent repair contract than generic design advice.

Payment is wired through Creem checkout for `UXRay Pro` at `$19/mo`, `UXRay Team` at `$99/mo`, and `UXRay Review Credits` at `$49` one-time. `/v1/billing/checkout` creates a Creem checkout session with `CREEM_API_KEY` when configured, then falls back to direct Creem payment links by `plan=pro|team|credits` if the secret is absent or Creem returns an error.

The public demo gallery currently shows 3 validated before/after screenshot pairs from the real eval run plus 7 install-to-run scenario cards. Do not present the 7 extra scenario cards as validated before/after proofs until their fixtures have been generated and repaired.

Current public before/after imagery is real eval evidence from `reports/evals/spike-007`:

```txt
landing-chaos baseline: 46 / 100
landing-chaos after:    100 / 100
same fixture family, same local reviewer, same viewport contract, same repair-loop prompt style
```

## Local commands

```bash
npm install
npm run typecheck
npm run build
npm run smoke:mcp
npm run api
npm run smoke:api
npm run eval:fixtures
npm run eval:reset
npm run demo:report
npm run demo:pipeline
npm run review:url
npm run review:diff
npm run check:update
npm run upgrade
npm run mcp
```

Run the local API:

```bash
PORT=4317 npm run api
```

Hosted render worker:

```bash
flyctl deploy
wrangler secret put RENDER_API_TOKEN
# set RENDER_API_BASE to the Fly app URL in wrangler.toml or deployment config
npm run cloudflare:deploy
```

The Fly worker is intentionally narrow: it runs the browser-capable Node API only. It should use `RENDER_API_TOKEN`, `UXRAY_REQUIRE_PUBLIC_URL=true`, and hard timeouts so public hosted rendering cannot access localhost/private-network URLs.

Run the fixture eval pack:

```bash
EVAL_PHASE=baseline npm run eval:fixtures
EVAL_PHASE=after npm run eval:fixtures
```

Generate the demo report from saved eval summaries:

```bash
npm run demo:report
```

Run the one-shot local demo pipeline. This resets eval fixtures to flawed seeds, runs baseline eval, asks Codex to repair via MCP screenshots, runs after eval, generates the demo report, and builds:

```bash
npm run demo:pipeline
```

To test orchestration without invoking Codex:

```bash
SKIP_CODEX_REPAIR=1 npm run demo:pipeline
```

Run the rendered smoke test:

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory examples/bad-landing
TEST_URL=http://127.0.0.1:4173 npm run smoke:render
```

Run the vision smoke test. Without `OPENAI_API_KEY`, this exercises the safe fallback path. With a real OpenAI API key that has Responses API write scope, it runs the model-based screenshot judge.

```bash
TEST_URL=http://127.0.0.1:4173 npm run smoke:vision
OPENAI_API_KEY=... TEST_URL=http://127.0.0.1:4173 npm run smoke:vision
```

For the Codex-login path, do not force a server-side API key. Ask the MCP tool to return images, then let Codex inspect them with its own logged-in model session:

```bash
HOME=/home/nxank4 codex exec --sandbox workspace-write --cd /home/nxank4/Code/hermes/codepawl/ui-reviewer \
  "Use the ui-reviewer MCP server to call review_ui_url on http://127.0.0.1:4173 with viewport desktop and mobile, strictness high, use_vision false, return_images true. Inspect the attached screenshots yourself and report one visual UX issue."
```

This is the preferred local demo path when Codex is logged in through the browser/link flow instead of an `OPENAI_API_KEY`.

Run the repair-loop scorecard helper:

```bash
REVIEW_LABEL=before TEST_URL=http://127.0.0.1:4173 npm run review:url
REVIEW_LABEL=after TEST_URL=http://127.0.0.1:4173 npm run review:url
npm run review:diff
```

Spike 004 validated the Codex loop: baseline score `82`, repaired score `100`, high-severity issues `1 -> 0`.

Register with Codex:

```bash
codex mcp add ui-reviewer -- npm --prefix /home/nxank4/Code/hermes/codepawl/ui-reviewer run mcp
codex mcp list
```

Hermes session note: this shell's default `HOME` is profile-local. To use An's real Codex login/config from Hermes terminal calls, prefix Codex commands with `HOME=/home/nxank4`.

Verified Codex roundtrip:

```bash
HOME=/home/nxank4 codex exec --sandbox read-only --cd /home/nxank4/Code/hermes/codepawl/ui-reviewer "Use the ui-reviewer MCP server..."
# mcp: ui-reviewer/health_check (completed)
# mcp: ui-reviewer/review_ui_url (completed)
# score: 82
```
