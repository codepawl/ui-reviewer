# 015: Creem checkout + advanced UXRay workflow research

## What changed

- Created/located Creem store: `codepawl`.
- Created UXRay Pro, Team, and Review Credits Creem products in the CodePawl store.
- Wired the public Worker endpoint by plan:

```txt
GET|POST https://useuxray.com/v1/billing/checkout?plan=pro     -> 303 Creem UXRay Pro checkout
GET|POST https://useuxray.com/v1/billing/checkout?plan=team    -> 303 Creem UXRay Team checkout
GET|POST https://useuxray.com/v1/billing/checkout?plan=credits -> 303 Creem review credits checkout
```

- Added Creem webhook endpoint: `https://useuxray.com/v1/billing/creem/webhook`.

- Added `/account.html` as the Creem post-checkout handoff target.
- Updated `/checkout.html`, `/docs.html`, `/v1/install`, README, and the Worker metadata to say Creem, not Stripe/Polar/shell checkout.
- Removed duplicate integration fallback icons. The HTML now keeps only `<iconify-icon>` entries; `site.js` hydrates SVGs from Iconify API if the web component CDN fails.

## Creem state

Creem docs verified:

- API base: `https://api.creem.io` production, `https://test-api.creem.io` sandbox.
- Auth: `x-api-key` header.
- Checkout API: `POST /v1/checkouts` with `product_id`; returns `checkout_url`.
- No-code checkout link pattern: `https://creem.io/payment/prod_xxxxx?theme=dark`.

Current implementation creates Creem checkout sessions when the Worker has `CREEM_API_KEY`. It keeps direct product payment links as a fallback so checkout CTAs do not 500 if Creem rejects a session request while billing setup changes.

## Billing state

UXRay is integrated with Creem and live-routed. The Worker supports Pro, Team, and one-time review credits by plan key, and a Creem webhook is registered against the live endpoint. Production collection depends on the Creem account/product live-mode state outside this repo.

## Research notes for improving UXRay taste

Sources checked:

- Creem docs: MoR SaaS billing, checkout links, `/v1/checkouts`, subscriptions, customer credits.
- NN/g 10 usability heuristics: system status, match to real-world language, control/freedom, consistency, error prevention, recognition over recall, efficiency, minimalist design, error recovery, help/docs.
- Baymard ecommerce UX research: checkout/form/search/mobile/product-listing guidance is strong source material for domain-specific rule packs.
- WebArena / VisualWebArena: useful pattern for realistic, task-grounded web-agent evaluation instead of static screenshot-only judging.
- Multimodal critique / pairwise evaluation research: useful for before-vs-after preference judging and visual grounding.

## Recommended next workflows

1. **Evidence-first review**
   - Deterministic checks first: DOM text, headings, buttons, links, forms, overflow, viewport screenshots.
   - Use model feedback only after evidence is captured.

2. **Repair-plan pass**
   - Convert UXRay issues into region-level repair contracts.
   - Output: `region`, `selector_hint`, `change`, `constraints`, `acceptance_checks`, and `regression_risks`.

3. **Taste critic pass**
   - Dedicated visual model/reviewer for hierarchy, rhythm, whitespace, density, contrast, aesthetic fit, and AI-slop markers.
   - Keep this separate from deterministic scoring so subjective taste cannot hide task-flow failures.

4. **Pairwise before/after judge**
   - Given two screenshots and the same task, choose which UI is easier to understand and why.
   - Block if the after version is prettier but less task-clear.

5. **Domain rule packs**
   - Landing: CTA clarity, proof, trust, above-fold hierarchy.
   - Dashboard: density, grouping, scan path, empty/loading/error states.
   - Onboarding: progressive disclosure, form burden, state recovery.
   - Checkout/pricing: trust, hidden fees, error recovery, guest-friendly flow.
   - Docs: quickstart time-to-first-success, copy-paste correctness, troubleshooting.

6. **Model-council mode**
   - Fast small model: DOM/heuristic triage.
   - Strong vision model: screenshot/taste pass.
   - Final pairwise judge: before/after preference.
   - Merge only evidence-backed findings. Do not average vague opinions.

7. **Hosted backend path**
   - Cloudflare remains public site + redirect/API metadata.
   - Browser-capable backend runs Playwright reviews, stores reports, decrements Creem/customer credits, and exposes saved proof galleries.

## Experiment run this spike

The payment integration was tested as a live route, not just static copy:

```txt
https://useuxray.com/v1/billing/checkout?plan=pro     -> 303 Creem checkout/product URL
https://useuxray.com/v1/billing/checkout?plan=team    -> 303 Creem checkout/product URL
https://useuxray.com/v1/billing/checkout?plan=credits -> 303 Creem checkout/product URL
https://useuxray.com/v1/billing/creem/webhook -> 200
https://useuxray.com/checkout.html -> 200
https://useuxray.com/account.html -> 200
https://useuxray.com/site.js -> contains hydrateIconifyFallbacks
```

The icon experiment removed the old glyph fallback and kept only Iconify source icons. If `iconify-icon` does not hydrate, `site.js` fetches the same Iconify SVG into the same element, so there is no duplicate icon.
