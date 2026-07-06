# 011: Real-evidence landing refinement

## Goal

Respond to feedback that the public landing had too many dense cards/components, fake-looking before/after visuals, and excess copy.

## Changes

- Simplified the landing to fewer, larger sections.
- Moved real before/after evidence into the hero.
- Replaced decorative SVG mockups with actual screenshots from `reports/evals/spike-007`.
- Shortened the hero hook to: `AI builds the UI. UXRay catches the mess.`
- Reduced copy density and removed extra cards.
- Kept dither/blur/glow in the background so it does not cover text.
- Added hover effect on the UXRay brand mark.
- Added GitHub navigation link.
- Improved docs with fair-demo setup, real score evidence, Codex/Claude Code/API commands, tool contract, and paid API direction.

## Real evidence used

```txt
reports/screenshots/127-0-0-1-5182-landing-chaos-f6a9e222-desktop.png
reports/screenshots/127-0-0-1-5183-landing-chaos-ac010569-desktop.png
reports/screenshots/127-0-0-1-5182-landing-chaos-f6a9e222-mobile.png
reports/screenshots/127-0-0-1-5183-landing-chaos-ac010569-mobile.png
```

Public assets generated:

```txt
apps/site/assets/evidence/landing-before.webp
apps/site/assets/evidence/landing-after.webp
apps/site/assets/evidence/landing-before-mobile.webp
apps/site/assets/evidence/landing-after-mobile.webp
```

## Fairness claim

The showcased before/after comes from the same `landing-chaos` fixture family, same local reviewer, same viewport contract, and same repair-loop prompt style.

```txt
baseline score: 46 / 100
actual after score: 100 / 100
fixed categories: intent_fit, responsive, task_flow
```

## Verification

Run:

```bash
npm run typecheck && npm run build
HOME=/home/nxank4 npx wrangler deploy --dry-run
HOME=/home/nxank4 npx wrangler deploy
```

Visual verification:

- Landing opened in Wrangler dev.
- Docs opened in Wrangler dev.
- Browser console had no JavaScript errors.
- Live site should be checked after deploy.
