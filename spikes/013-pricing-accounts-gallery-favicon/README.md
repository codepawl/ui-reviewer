# 013: Pricing, accounts, gallery zoom, code color, favicon

## Goal

Improve the public UXRay site so it sells the product better without lying about proof.

## Changes

- Added favicon assets:
  - `apps/site/favicon.svg`
  - `apps/site/favicon.ico`
- Added syntax-colored code/command snippets through `apps/site/site.js` and token CSS.
- Added click-to-zoom lightbox for all before/after evidence screenshots.
- Added subtle image preview glow on hover.
- Expanded demo gallery to 10 scenarios:
  - 3 validated real before/after screenshot pairs.
  - 7 clearly labeled install-to-run scenarios, not fake proof.
- Added "And many more" upsell band.
- Added pricing section to landing:
  - Local: $0
  - Pro: $19/mo placeholder
  - Team: custom
- Added account shell pages:
  - `/login.html`
  - `/signup.html`
- Added UXRay agent skill download:
  - `/plugins/uxray-agent-skill.md`
- Expanded docs with skill install, plugin/account direction, and paid API positioning.
- Expanded Worker JSON endpoints:
  - `/v1/install` includes skill URL and pricing direction.
  - `/v1/auth/login` and `/v1/auth/register` return product-shell status until real auth/billing is wired.

## Proof discipline

Only the first 3 gallery cases are presented as validated before/after proof:

- landing-chaos: 46 → 100
- dashboard-density: 36 → 100
- onboarding-form: 36 → 100

The extra 7 scenario cards are framed as install-to-run scenarios for upsell and future gallery proof.

## Verification

Run:

```bash
npm run typecheck
npm run build
HOME=/home/nxank4 npx wrangler deploy --dry-run
```

Local Wrangler preview verified:

- `/`
- `/docs.html`
- `/demo-report.html`
- `/login.html`
- `/signup.html`
- `/favicon.svg`
- `/favicon.ico`
- `/plugins/uxray-agent-skill.md`
- `/v1/install`
- `/v1/auth/register`
