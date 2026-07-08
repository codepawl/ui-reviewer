# Security Policy

## Public repo boundary

UXRay is intended to use an open-core split:

- Public: local MCP server, local reviewer core, renderer abstraction, install docs, examples, public agent rules, and marketing/docs assets.
- Private/proprietary: hosted browser fleet, multi-tenant auth operations, billing fulfillment, report-retention operations, abuse controls, internal admin tooling, customer data workflows, and deployment runbooks that expose infrastructure assumptions.

Security must not rely on the repository being private. Public code is acceptable only when it is written as public-safe code with no secrets and no customer data.

## Never commit

Do not commit any of the following to this repository:

- `.env` files or local secret stores
- Cloudflare API tokens or Wrangler credentials
- Creem API keys or webhook secrets
- database connection strings
- session cookies, magic-link tokens, API keys, or OAuth tokens
- customer screenshots, private reports, or private dashboard exports
- production deployment runbooks containing sensitive infrastructure details

Use deployment secret managers instead:

- Cloudflare Worker secrets for `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET`, and render-worker tokens
- GitHub Actions secrets for CI-only tokens
- local private files such as `~/.uxray/cloud.env` for developer API keys

## Cloud code guidance

It is safe to keep thin public Worker/control-plane code in this repo if it contains no secrets, has explicit auth/credit gates, blocks private-network hosted rendering, and is verified by smoke tests.

Keep cloud-specific code private when it includes proprietary or security-sensitive implementation details such as hosted render queues, tenant isolation, abuse prevention, billing reconciliation, customer data retention, admin actions, internal observability, or enterprise controls.

## Reporting vulnerabilities

For security reports, contact CodePawl privately before public disclosure. Do not open public issues containing secrets, exploit details, customer data, or bypass instructions.
