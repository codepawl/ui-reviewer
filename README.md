# UXRay

UXRay is a local-first UI/UX review gate for AI-built frontends. It gives coding agents a concrete repair contract instead of vague design advice:

```txt
health_check -> review_ui_url -> repair UI -> review_ui_diff
```

The public repo is the Apache-2.0 local MCP/core. The commercial cloud code has been split into the private `codepawl/uxray-cloud` repo.

## What stays public

- MCP server: `health_check`, `review_ui_url`, `review_ui_diff`, `check_update`
- reviewer core and structured report schema
- local Playwright renderer
- optional vision adapter interface
- local HTTP API wrapper for development/smoke use
- eval fixtures and reproducible repair-loop demos
- agent auto-trigger rules for Codex, Claude Code-compatible MCP clients, and OMP
- public docs about the open-core/cloud boundary

## What moved private

Private cloud/product code now lives in `/home/nxank4/Code/hermes/codepawl/uxray-cloud` and the GitHub private repo `codepawl/uxray-cloud`:

- Cloudflare Worker production control plane
- hosted account/session/dashboard code
- API-key issuance and hosted credit gates
- Creem checkout/webhook handling
- D1/R2 migrations and persisted report operations
- public production website/account/checkout assets
- hosted render deployment/runbooks and cloud smokes
- customer-data and internal admin workflows

Security should not rely on repo secrecy, but private cloud code keeps the public repo clean and reduces leaked business/infra assumptions. See `SECURITY.md`.

## Install

```bash
git clone https://github.com/codepawl/uxray uxray
cd uxray
npm install
npm run typecheck
npm run build
npm run smoke:mcp
```

## Run as MCP

```bash
npm run mcp
```

Codex:

```bash
codex mcp add uxray -- npm --silent --prefix /absolute/path/to/uxray run mcp
```

Generic MCP JSON:

```json
{
  "mcpServers": {
    "uxray": {
      "command": "npm",
      "args": ["--silent", "--prefix", "/absolute/path/to/uxray", "run", "mcp"]
    }
  }
}
```

Install agent rules locally:

```bash
npm run install:agents
npm run smoke:agents
```

## Local API smoke

```bash
PORT=4317 npm run api
npm run smoke:api
```

The public API wrapper is for local development and smoke tests. Production account/dashboard/billing/hosted persistence lives in the private cloud repo.

## Repair-loop proof

Run the deterministic fixture pack:

```bash
npm run eval:reset
npm run eval:fixtures
npm run demo:report
```

The validated demo loop from this repo showed:

```txt
average score: 39 -> 100
issues:        11 -> 0
high severity:  9 -> 0
fixtures: landing, dashboard, onboarding
```

## Scripts

```bash
npm run typecheck
npm run build
npm run smoke:mcp
npm run smoke:render
npm run smoke:vision
npm run smoke:api
npm run eval:reset
npm run eval:fixtures
npm run demo:pipeline
npm run review:url
npm run review:diff
npm run check:update
npm run upgrade
npm run test:core
npm run install:agents
npm run smoke:agents
```

## License

Apache-2.0. See `LICENSE`.

## Cloud boundary

Keep these out of the public repo:

- `.env` and local secret stores
- Cloudflare/Wrangler/Creem tokens
- API keys, session cookies, magic-link tokens, OAuth tokens
- customer screenshots/private reports
- hosted render queues/fleet internals
- tenant isolation, billing reconciliation, abuse controls
- internal admin tooling and sensitive deployment runbooks

Thin public-safe abstractions are fine. Production cloud code belongs in `codepawl/uxray-cloud`.
