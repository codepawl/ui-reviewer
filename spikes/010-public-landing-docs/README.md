# 010: Public landing + install docs refresh

## Goal

Turn the Cloudflare-hosted UXRay demo into a more product-ready landing page with stronger visual taste, before/after images, clear installation paths, and docs for multiple coding agents.

## Design direction

The page intentionally mixes:

- Claude warmth: parchment, terracotta, editorial spacing, soft human feel.
- ChatGPT-like simplicity: dark calm canvas, clean rounded panels, restrained glow.
- Mobbin/Behance/Dribbble influence: stronger hero composition, before/after product visuals, polished marketing sections.
- Developer-tool precision: Geist/mono labels, command snippets, measurable scorecards.

The site avoids generic SaaS icon grids and keeps the core proof visible: UXRay improves AI-generated UI through a measurable review/repair/diff loop.

## Added pages/assets

```txt
apps/site/index.html
apps/site/docs.html
apps/site/demo-report.html
apps/site/styles.css
apps/site/assets/before.svg
apps/site/assets/after.svg
```

## Hosted endpoints

```txt
GET /health
GET /v1/install
GET /v1/demo/report
POST /v1/reviews/diff
POST /v1/reviews/url
```

`/v1/install` now exposes setup snippets for:

- Codex
- Claude Code
- local API

## Install docs content

The hosted docs include:

1. Local install.
2. Codex MCP registration.
3. Claude Code MCP registration.
4. Local API usage.
5. Full demo pipeline.
6. MCP tool contract.
7. Paid API direction.

## Before/after visuals

The landing and demo report now include two real SVG image assets:

- `before.svg`: cluttered generated UI, conflicting CTAs, high-severity issue callout.
- `after.svg`: repaired UI, one clear path, pass state.

## Pricing direction captured

The landing includes a "Next: paid calls" section with the suggested path:

- Free local developer wedge.
- Usage API charged per rendered review or diff call.
- Team monthly bundle for AI frontend teams.

Hosted rendering should move to a browser-capable runtime such as Browserbase, Cloud Run, Fly.io, Render, or a controlled worker pool. Cloudflare can remain the marketing/API edge.

## Verification checklist

Run before claiming done:

```bash
npm run typecheck
npm run build
HOME=/home/nxank4 npx wrangler deploy
```

Then verify:

```txt
https://useuxray.com/
https://useuxray.com/docs.html
https://useuxray.com/demo-report.html
https://useuxray.com/v1/install
https://useuxray.com/v1/demo/report
```
