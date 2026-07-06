# 012: Demo gallery refinement

## Goal

Make the public `Demo` nav open a real proof gallery instead of a page that feels like a second landing page.

## Changes

- `demo-report.html` is now a gallery with three real before/after cases:
  - Landing chaos: `46 -> 100`
  - Dashboard density: `36 -> 100`
  - Onboarding form dump: `36 -> 100`
- Added real screenshot assets for dashboard and onboarding cases.
- Moved the landing hero proof-strip below the hero evidence card instead of under the copy.
- Removed eyebrow-style labels from the landing hero and main sections.
- Added proof-section CTAs:
  - `Open proof gallery`
  - `Reproduce the run`
- GitHub links now point to the intended repo URL: `https://github.com/codepawl/ui-reviewer`.

## New gallery assets

```txt
apps/site/assets/evidence/dashboard-before.webp
apps/site/assets/evidence/dashboard-after.webp
apps/site/assets/evidence/onboarding-before.webp
apps/site/assets/evidence/onboarding-after.webp
```

Existing landing assets remain:

```txt
apps/site/assets/evidence/landing-before.webp
apps/site/assets/evidence/landing-after.webp
```

## Verification

Run:

```bash
npm run typecheck && npm run build
HOME=/home/nxank4 npx wrangler deploy --dry-run
HOME=/home/nxank4 npx wrangler deploy
```

Verify live:

```txt
https://useuxray.com/
https://useuxray.com/demo-report.html
https://useuxray.com/assets/evidence/dashboard-before.webp
https://useuxray.com/assets/evidence/onboarding-after.webp
```

Note: at the time of this change, `gh` was not logged in and `https://github.com/codepawl/ui-reviewer` returned 404 publicly. The site points at the intended repo URL, but the repo must be created/published for the link to resolve.
