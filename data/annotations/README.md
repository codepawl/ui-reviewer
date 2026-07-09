# UXRay preference annotations

This directory stores aggregate pairwise UI preference data.

Rules:

- Store aggregate counts and labels only. Do not store voter identities.
- Pairwise choices beat abstract 1-10 ratings.
- Every public poll task should have a task JSON under `data/annotations/tasks/` and ingested records in `uxray-preference-events.jsonl`.
- Public X polls are noisy. Treat them as model-training and heuristic-tuning signals, not as absolute truth.
- Promote repeated patterns into deterministic metrics only after multiple records or an expert confirmation.

Core commands:

```bash
npm run annotation:pairwise -- \
  --axis spacing_rhythm \
  --profile simplicity \
  --route-type docs \
  --a-label "tight gap" \
  --b-label "more breathing room" \
  --prompt "Which version is easier to scan?"

npm run annotation:answer -- \
  --task data/annotations/tasks/<task_id>.json \
  --choice b \
  --confidence 0.9 \
  --preferred "clear hierarchy,specific workflow copy" \
  --rejected "card soup,generic SaaS copy" \
  --note "B feels less generated and explains the mechanism better."

npm run annotation:ingest:x -- \
  --task data/annotations/tasks/<task_id>.json \
  --post-id 1234567890 \
  --post-url https://x.com/nxank4/status/1234567890 \
  --a 42 --b 71 --tie 5

npm run correction:add -- \
  --report reports/reviews/before.json \
  --axis ai_slop \
  --region features \
  --profile technical_premium \
  --note "Card grid + secondary callouts feel generic; collapse into mechanism-specific workflow."

npm run preference:context -- \
  --profile technical_premium \
  --route-type landing

npm run benchmark:taste
npm run benchmark:run
npm run benchmark:run -- --review 1 --limit 3 --keep-going 1
DEEPINFRA_API_KEY=... npm run benchmark:generate:deepinfra -- --limit 1
npm run benchmark:run -- --output-root reports/taste-benchmark-deepinfra --materialize 0 --review 1 --keep-going 1
npm run benchmark:repair:deepinfra -- \
  --prompt-id agent_chat_ui \
  --condition uxray_repair \
  --source-root reports/taste-benchmark-routepacks-v2 \
  --output-root reports/taste-benchmark-actual-repair \
  --repair-mode conservative
npm run benchmark:auto-repair:deepinfra -- \
  --prompt-id agent_chat_ui \
  --condition uxray_repair \
  --source-root reports/taste-benchmark-routepacks-v2 \
  --output-root reports/taste-benchmark-auto-repair \
  --max-iterations 3 \
  --target-score 90 \
  --repair-mode auto
npm run benchmark:taste -- --summarize reports/taste-benchmark
```

Benchmark prompts:

- `data/benchmarks/taste-loop-prompts.json`
- Conditions: `baseline`, `taste_context`, `uxray_repair`
- Repair modes: `conservative`, `structural`, or `auto` escalation. `auto` starts conservative, then escalates to structural repair when non-high density/hierarchy/task-flow issues remain or conservative repair plateaus.
- Default benchmark plan output: `reports/taste-benchmark/run-plan.json`
- The plan is a generation/evaluation contract: use each `run.generator_prompt` to create an artifact, save the UXRay report at `run.expected_artifacts.review_report_path`, then summarize all `review.json` files.

Schemas:

- `schemas/uxray-preference-dataset.schema.json`
- `schemas/uxray-correction.schema.json`

Taste profiles:

- `data/annotations/taste-profiles.json`
- `technical_premium`: high-trust technical product UI; concrete mechanism proof, quiet hierarchy, no card soup.
- `editorial_dense`: information-rich pages where scan quality matters more than luxury whitespace.
- `simple_saas`: low-friction SaaS landing/signup surfaces with one obvious path.
- Core review still maps to UXRay's built-in `simplicity`, `balanced`, and `complexity` profiles until extended profile IDs are wired into MCP/reviewer-core.
