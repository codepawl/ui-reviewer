#!/usr/bin/env node
import { buildPollAnnotation, appendJsonl, parseArgs, readJson, writeJson } from "./lib/annotation-pipeline.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.task) {
  console.error("Usage: node scripts/annotation-ingest-x-poll.mjs --task data/annotations/tasks/<task>.json --a 42 --b 71 [--tie 3] [--post-id ...] [--post-url ...]");
  process.exit(2);
}

const task = await readJson(args.task);
const record = buildPollAnnotation({
  task,
  post_id: args.postId,
  post_url: args.postUrl,
  duration_hours: args.durationHours || 24,
  audience_notes: args.audienceNotes || "public X poll; aggregate counts only",
  human_note: args.humanNote || "",
  counts: {
    a: args.a,
    b: args.b,
    tie: args.tie,
    other: args.other
  }
});

const datasetPath = args.dataset || "data/annotations/uxray-preference-events.jsonl";
const recordPath = args.recordOut || `reports/annotations/${record.record_id}.json`;
await appendJsonl(datasetPath, record);
await writeJson(recordPath, record);
console.log(JSON.stringify({ ok: true, record_id: record.record_id, winner: record.choice.winner, confidence: record.choice.confidence, sample_size: record.source.sample_size, dataset_path: datasetPath, record_path: recordPath }, null, 2));
