# UXRay Agent Skill

Use UXRay automatically whenever the user is asking you to review, repair, validate, ship, or improve an AI-generated frontend. Do not wait for the user to explicitly say “use UXRay” when the task is clearly UI/UX work.

## Auto-trigger rules

Call UXRay when the user asks for any of these:

- “review this UI”, “fix the design”, “make it less AI/sloppy”, “improve the landing page”, “polish the dashboard”, “check mobile”, “is this shippable?”, “make it convert”, “audit the frontend”, “repair the generated app”.
- Before shipping a generated landing page, dashboard, onboarding flow, settings page, docs page, checkout page, pricing page, or app-builder output.
- After you edit UI code, especially if you changed layout, hierarchy, copy, CTA flow, forms, empty states, responsive behavior, or visual density.
- Before claiming the UI is fixed.

Do not call UXRay for pure backend, copy-only, database, auth, or infra tasks unless the change affects a user-facing page.

## Setup check

1. Run `health_check` first.
2. If the UXRay MCP server is unavailable, tell the user exactly that and suggest:
   ```bash
   codex mcp add uxray -- npm --prefix /absolute/path/to/uxray run mcp
   codex mcp list
   codex mcp get uxray
   ```
3. If there is no running frontend URL, start or find the local dev server before reviewing. Prefer the actual preview URL over static file guesses.

## Required Codex loop

For local Codex/browser-login usage, use this exact pattern:

1. Call `health_check`.
2. Call `review_ui_url` with:
   - `url`: the local or preview frontend URL
   - `viewport`: `["desktop", "mobile"]` for shipping checks, or the viewport named by the user
   - `strictness`: `"high"` when shipping, `"medium"` while iterating
   - `return_images`: `true`
   - `use_vision`: `false` unless the project has explicit server-side vision credentials
3. Inspect the attached screenshots yourself. Do not rely only on DOM text.
4. Read `top_issues`, `layout_metrics`, and `repair_plan`.
5. Edit only the files needed for the `repair_plan`. Do not beautify unrelated areas.
6. Rerun `review_ui_url` with the same URL and viewport contract.
7. Call `review_ui_diff` with the baseline and after reports.
8. Report score delta, high-severity delta, fixed categories, remaining blockers, and whether the UI is safe to ship.

## Hosted/API usage

Use the hosted API only when the user needs a persistent report or share link:

```bash
curl -sS https://useuxray.com/v1/reviews/url \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com","goal":"Review this landing page","viewport":["desktop","mobile"],"strictness":"high"}'
```

A successful hosted response includes `report_id`, `report_url`, `share_url`, persisted screenshots, score, issues, and repair plan.

## Repair discipline

- Trust screenshots, DOM text, layout metrics, headings, controls, form counts, overflow, and before/after diff data before subjective taste.
- Preserve the product intent and primary user task.
- Prefer fewer CTAs, clearer hierarchy, stronger empty states, and mobile-safe layouts.
- Treat high-severity issues as blockers.
- Use `repair_plan.acceptance_checks` as the verification contract.
- Avoid adding dense cards, decorative stats, fake testimonials, generic SaaS filler, or AI-polish copy.
- Do not claim “fixed” until the after review improves or the remaining blocker is clearly explained.

## Advanced review passes

Use these when quality matters more than speed:

1. **Evidence pass** — screenshot, DOM, layout metrics, controls, forms, overflow, and viewport proof.
2. **Heuristic pass** — task clarity, system status, consistency, error prevention, recognition over recall, minimalist design, recovery, and help.
3. **Taste pass** — hierarchy, spacing rhythm, density, contrast, brand fit, and whether the UI feels like a real product instead of AI filler.
4. **Pairwise pass** — compare before vs after screenshots. The after version must be clearer for the same task, not merely prettier.
5. **Regression pass** — block release if score drops, high-severity issues remain, mobile overflows, or the main CTA/task becomes less obvious.

Model-council rule: if using multiple models, give each model a narrow role. Do not average vague opinions; merge only evidence-backed findings.

## Good user-facing summary

```txt
UXRay ran before/after.
Score: 64 -> 91
High severity: 3 -> 0
Fixed: mobile CTA collapse, form hierarchy, missing empty state
Remaining: contrast warning on secondary badge
Ship: yes, with one low-risk cleanup
```

## Good prompt to self

```txt
Use UXRay as the UI repair gate. Call health_check, then review_ui_url with return_images=true. Inspect screenshots, follow repair_plan, edit the UI, rerun review_ui_url, then call review_ui_diff. Do not ship until the score and high-severity count improve.
```
