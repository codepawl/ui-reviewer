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

npm run annotation:ingest:x -- \
  --task data/annotations/tasks/<task_id>.json \
  --post-id 1234567890 \
  --post-url https://x.com/nxank4/status/1234567890 \
  --a 42 --b 71 --tie 5
```

Dataset schema:

- `schemas/uxray-preference-dataset.schema.json`

Taste profiles:

- `simplicity`: fewer layers, calmer spacing, fewer CTAs, stronger scan path.
- `balanced`: default product UX tradeoff.
- `complexity`: accepts denser information when hierarchy, grouping, and progressive disclosure are clear.
