# 014: CodePawl repo, hero cleanup, method/icons, pay checkout

## Goal

Apply product/content polish requested after public launch feedback:

- Move public repo/org references to `codepawl`.
- Remove hero metric strip from the evidence card.
- Ensure hero before/after screenshots are zoomable.
- Center the method section and make `Review → repair → diff.` stay on one line on desktop.
- Make method list numbers larger.
- Begin icon integration for agent targets.
- Replace waitlist-style CTAs with pay/checkout CTAs.

## Changes

- Public GitHub links now point to `https://github.com/codepawl/ui-reviewer`.
- Removed `.hero-metrics` markup and unused CSS.
- Hero images have `.zoomable`, keyboard focus, button role, and click-to-zoom lightbox support.
- Added Iconify icons for Codex, Claude Code, MCP, CLI, and hosted API.
- Method section is centered; desktop heading uses `white-space: nowrap`; mobile relaxes to normal wrapping.
- Method step numbers are larger (`clamp(34px, 4vw, 54px)`).
- Added `/checkout.html` and changed pricing/nav/signup CTAs to proceed to payment.
- Worker now accepts `/v1/billing/checkout` as the Creem checkout entrypoint.

## Verification

- `npm run typecheck && npm run build` passed.
- `wrangler deploy --dry-run` passed.
- Live deploy passed.
- Live route check confirmed CodePawl repo links, no waitlist copy, and no hero metric strip in public pages/API responses.
- CDP verified on live page:
  - hero click opens `.image-lightbox.is-open`
  - GitHub link is `https://github.com/codepawl/ui-reviewer`
  - `.hero-metrics` is absent
  - method heading is centered and `nowrap`
  - method number font size is `54px`
  - checkout link exists
