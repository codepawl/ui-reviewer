#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildPairwiseTask, buildXPollDraft, buildPollAnnotation, buildExpertAnnotation, appendJsonl, writeJson } from "./lib/annotation-pipeline.mjs";

const dir = await mkdtemp(path.join(tmpdir(), "uxray-annotation-"));
try {
  const task = buildPairwiseTask({
    axis: "spacing_rhythm",
    profile: "simplicity",
    route_type: "docs",
    prompt: "Which spacing feels easier to scan?",
    a: { label: "tight gap", screenshot_url: "https://example.com/a.png", metrics: { tight_block_spacing_count: 1 } },
    b: { label: "more breathing room", screenshot_url: "https://example.com/b.png", metrics: { tight_block_spacing_count: 0 } }
  });
  assert.equal(task.schema_version, "uxray.preference.v1");
  assert.equal(task.axis, "spacing_rhythm");
  assert.equal(task.target_profile, "simplicity");

  const draft = buildXPollDraft(task);
  assert.match(draft.text, /poll below: A \/ B \/ tie/);
  assert.deepEqual(draft.poll_options, ["A", "B", "tie / depends"]);

  const record = buildPollAnnotation({ task, post_id: "123", post_url: "https://x.com/nxank4/status/123", counts: { a: 12, b: 81, tie: 7 } });
  assert.equal(record.choice.winner, "b");
  assert.equal(record.derived_targets.model_training.pairwise_label, "b_preferred");
  assert.equal(record.derived_targets.hard_filter_updates[0].metric, "tight_block_spacing_count");
  assert.ok(record.choice.confidence > 0.2);

  const expertTask = buildPairwiseTask({
    axis: "ai_slop",
    profile: "balanced",
    route_type: "landing",
    prompt: "Which version looks less AI-generated while keeping the product task clear?",
    a: { label: "gradient card grid", metrics: { over_carded_section_count: 2 } },
    b: { label: "specific workflow", metrics: { over_carded_section_count: 0 } }
  });
  const expertRecord = buildExpertAnnotation({
    task: expertTask,
    winner: "b",
    confidence: 0.92,
    human_note: "B feels more intentional and less like generic SaaS filler.",
    preferred_traits: "specific workflow copy,clearer mechanism",
    rejected_traits: "card soup,decorative gradients"
  });
  assert.equal(expertRecord.source.kind, "expert_review");
  assert.equal(expertRecord.choice.winner, "b");
  assert.equal(expertRecord.derived_targets.model_training.pairwise_label, "b_preferred");
  assert.deepEqual(expertRecord.labels.preferred_traits, ["specific workflow copy", "clearer mechanism"]);

  const taskPath = path.join(dir, "task.json");
  const datasetPath = path.join(dir, "events.jsonl");
  await writeJson(taskPath, task);
  await appendJsonl(datasetPath, record);
  await appendJsonl(datasetPath, expertRecord);
  const line = (await readFile(datasetPath, "utf8")).trim();
  const lines = line.split("\n").map((item) => JSON.parse(item));
  assert.equal(lines[0].record_id, record.record_id);
  assert.equal(lines[1].record_id, expertRecord.record_id);
  console.log("annotation pipeline tests passed");
} finally {
  await rm(dir, { recursive: true, force: true });
}
