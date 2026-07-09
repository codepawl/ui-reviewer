#!/usr/bin/env node
import { appendJsonl, buildExpertAnnotation, parseArgs, readJson, writeJson } from "./lib/annotation-pipeline.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.task || !args.choice) {
  console.error([
    "Usage: node scripts/annotation-answer.mjs --task data/annotations/tasks/<task>.json --choice a|b|tie|unclear [options]",
    "",
    "Options:",
    "  --confidence 0.9",
    "  --note \"B has clearer hierarchy and less decorative filler.\"",
    "  --preferred \"clear hierarchy,specific workflow copy\"",
    "  --rejected \"card soup,generic SaaS copy\"",
    "  --reviewer an",
    "  --dataset data/annotations/uxray-preference-events.jsonl",
    "  --record-out reports/annotations/<record_id>.json"
  ].join("\n"));
  process.exit(2);
}

const task = await readJson(args.task);
const record = buildExpertAnnotation({
  task,
  winner: args.choice,
  confidence: args.confidence ?? 0.9,
  human_note: args.note || args.humanNote || "",
  preferred_traits: args.preferred || args.preferredTraits || "",
  rejected_traits: args.rejected || args.rejectedTraits || "",
  reviewer: args.reviewer || "local_expert"
});

const datasetPath = args.dataset || "data/annotations/uxray-preference-events.jsonl";
const recordPath = args.recordOut || `reports/annotations/${record.record_id}.json`;
await appendJsonl(datasetPath, record);
await writeJson(recordPath, record);
console.log(JSON.stringify({
  ok: true,
  record_id: record.record_id,
  source: record.source.kind,
  winner: record.choice.winner,
  confidence: record.choice.confidence,
  dataset_path: datasetPath,
  record_path: recordPath,
  preferred_traits: record.labels.preferred_traits,
  rejected_traits: record.labels.rejected_traits
}, null, 2));
