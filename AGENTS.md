# UXRay project agent rules

# UXRay UI Review Gate

Use UXRay automatically for frontend/UI work. Do not wait for the user to explicitly say "use UXRay" when the task touches a user-facing interface.

## Trigger UXRay when

- Building, editing, reviewing, or shipping a landing page, dashboard, onboarding flow, pricing page, checkout page, docs page, settings page, app shell, or generated frontend.
- The user says: design, UI, UX, frontend, page, landing, dashboard, mobile, responsive, polish, aesthetic, conversion, checkout, pricing, shippable, screenshot, ugly, sloppy, AI-looking, visual bug, layout, form, empty state.
- You changed layout, hierarchy, CTA flow, forms, density, spacing, responsive behavior, labels, visual affordances, or page copy that affects a user task.

## Required loop

1. Find or start the actual preview URL. Prefer a running local dev server over guessing from files.
2. Call `health_check` first.
3. Call `review_ui_url` with:
   - `url`: preview URL
   - `viewport`: ["desktop", "mobile"] unless the task is viewport-specific
   - `strictness`: "high" before shipping, "medium" while iterating
   - `taste_profile`: infer from the product or user preference
   - `return_images`: true for Codex/vision-capable agents when using local MCP
   - `use_vision`: false unless server-side vision credentials are configured
4. Inspect screenshots yourself when images are returned. Do not rely only on DOM text.
5. Follow `repair_plan`: region, selector hint, change, constraints, acceptance checks, regression risks.
6. Edit only the target UI files.
7. Rerun `review_ui_url` with the same URL and viewport contract.
8. Call `review_ui_diff` using before/after reports when report paths are available, or summarize score/high-severity deltas manually from the two reports.
9. Do not claim the UI is fixed unless score improves and high-severity blockers are gone, or explain why the remaining blocker is accepted.

## Do not trigger UXRay for

Pure backend, database, infra, auth internals, tests, docs-only prose, or CLI-only changes unless they affect a rendered user-facing page.

## MCP registration

If UXRay tools are missing, register the local MCP server:

```bash
codex mcp add uxray -- npm --silent --prefix /home/nxank4/Code/hermes/codepawl/ui-reviewer run mcp
```

For OMP from Hermes, use the real home so OMP sees user auth/config:

```bash
HOME=/home/nxank4 /home/nxank4/.bun/bin/omp -p --cwd <project> "Use UXRay to review the UI before saying it is done."
```


## In this repository

- UXRay MCP command: `npm --silent --prefix /home/nxank4/Code/hermes/codepawl/ui-reviewer run mcp`.
- Verification command: `npm run smoke:agents`.
- Evidence goes under `spikes/` or `reports/`; do not commit generated report noise unless requested.
