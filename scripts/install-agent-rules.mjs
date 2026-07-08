#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const realHome = process.env.UXRAY_REAL_HOME || process.env.REAL_HOME || process.env.HOME || homedir();
const uxrayRepo = process.env.UXRAY_REPO || repoRoot;
const projectOnly = process.argv.includes("--project-only");
const dryRun = process.argv.includes("--dry-run");

const ruleBody = `# UXRay UI Review Gate

Use UXRay automatically for frontend/UI work. Do not wait for the user to explicitly say "use UXRay" when the task touches a user-facing interface.

## Trigger UXRay when

- Building, editing, reviewing, or shipping a landing page, dashboard, onboarding flow, pricing page, checkout page, docs page, settings page, app shell, or generated frontend.
- The user says: design, UI, UX, frontend, page, landing, dashboard, mobile, responsive, polish, aesthetic, conversion, checkout, pricing, shippable, screenshot, ugly, sloppy, AI-looking, visual bug, layout, form, empty state.
- You changed layout, hierarchy, CTA flow, forms, density, spacing, responsive behavior, labels, visual affordances, or page copy that affects a user task.

## Required loop

1. Find or start the actual preview URL. Prefer a running local dev server over guessing from files.
2. Call \`health_check\` first.
3. Call \`review_ui_url\` with:
   - \`url\`: preview URL
   - \`viewport\`: ["desktop", "mobile"] unless the task is viewport-specific
   - \`strictness\`: "high" before shipping, "medium" while iterating
   - \`taste_profile\`: infer from the product or user preference
   - \`return_images\`: true for Codex/vision-capable agents when using local MCP
   - \`use_vision\`: false unless server-side vision credentials are configured
4. Inspect screenshots yourself when images are returned. Do not rely only on DOM text.
5. Follow \`repair_plan\`: region, selector hint, change, constraints, acceptance checks, regression risks.
6. Edit only the target UI files.
7. Rerun \`review_ui_url\` with the same URL and viewport contract.
8. Call \`review_ui_diff\` using before/after reports when report paths are available, or summarize score/high-severity deltas manually from the two reports.
9. Do not claim the UI is fixed unless score improves and high-severity blockers are gone, or explain why the remaining blocker is accepted.

## Do not trigger UXRay for

Pure backend, database, infra, auth internals, tests, docs-only prose, or CLI-only changes unless they affect a rendered user-facing page.

## MCP registration

If UXRay tools are missing, register the local MCP server:

\`\`\`bash
codex mcp add uxray -- npm --silent --prefix ${uxrayRepo} run mcp
\`\`\`

For OMP from Hermes, use the real home so OMP sees user auth/config:

\`\`\`bash
HOME=${realHome} /home/nxank4/.bun/bin/omp -p --cwd <project> "Use UXRay to review the UI before saying it is done."
\`\`\`
`;

const codexSkill = `---
name: uxray
description: Automatically run UXRay MCP for frontend/UI review, repair, and shipping checks.
---

${ruleBody}
`;

const ompSkill = codexSkill;

const projectAgents = `# UXRay project agent rules

${ruleBody}

## In this repository

- UXRay MCP command: \`npm --silent --prefix ${uxrayRepo} run mcp\`.
- Verification command: \`npm run smoke:agents\`.
- Evidence goes under \`spikes/\` or \`reports/\`; do not commit generated report noise unless requested.
`;

const writes = [
  { label: "project AGENTS.md", path: path.join(uxrayRepo, "AGENTS.md"), content: projectAgents }
];

if (!projectOnly) {
  writes.push(
    { label: "Codex UXRay skill", path: path.join(realHome, ".codex", "skills", "uxray", "SKILL.md"), content: codexSkill },
    { label: "OMP UXRay skill", path: path.join(realHome, ".omp", "agent", "skills", "uxray", "SKILL.md"), content: ompSkill },
    { label: "OMP project UXRay skill", path: path.join(uxrayRepo, ".omp", "skills", "uxray", "SKILL.md"), content: ompSkill }
  );
}

for (const item of writes) {
  const existed = existsSync(item.path);
  let previous = "";
  if (existed) previous = await readFile(item.path, "utf8");
  if (previous === item.content) {
    console.log(JSON.stringify({ path: item.path, label: item.label, status: "unchanged" }));
    continue;
  }
  if (!dryRun) {
    await mkdir(path.dirname(item.path), { recursive: true });
    await writeFile(item.path, item.content);
  }
  console.log(JSON.stringify({ path: item.path, label: item.label, status: existed ? "updated" : "created", dry_run: dryRun }));
}
