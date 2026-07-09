#!/usr/bin/env node
import { appendJsonl, parseArgs, readJson, splitList, stableId, writeJson, nowIso } from "./lib/annotation-pipeline.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.report || !args.note) {
  console.error([
    "Usage: node scripts/correction-add.mjs --report reports/reviews/before.json --note \"Human correction\" [options]",
    "",
    "Options:",
    "  --axis ai_slop",
    "  --region features",
    "  --profile technical_premium",
    "  --severity medium",
    "  --preferred \"specific workflow copy,clear hierarchy\"",
    "  --rejected \"card soup,generic copy\"",
    "  --candidate-for \"prompt_guidance,vision_judge_rubric\"",
    "  --deterministic 0",
    "  --dataset data/annotations/uxray-corrections.jsonl",
    "  --record-out reports/annotations/<record_id>.json"
  ].join("\n"));
  process.exit(2);
}

const report = await readJson(args.report);
const screenshots = (report.rendered_context?.screenshots || [])
  .map((item) => item.path)
  .filter(Boolean);
const layoutMetrics = Object.fromEntries((report.rendered_context?.screenshots || [])
  .filter((item) => item.name && item.layout_metrics)
  .map((item) => [item.name, item.layout_metrics]));
const topIssueCategories = Array.from(new Set((report.top_issues || []).map((issue) => issue.category).filter(Boolean)));
const axis = args.axis || "custom";
const record = {
  schema_version: "uxray.correction.v1",
  record_id: stableId("corr", { report: args.report, axis, note: args.note, region: args.region || "unspecified" }),
  created_at: nowIso(),
  source: {
    kind: args.sourceKind || "expert_review",
    reviewer: args.reviewer || "local_expert"
  },
  review: {
    report_path: args.report,
    reviewed_url: report.reviewed_url || null,
    score: report.score ?? null,
    verdict: report.verdict || null,
    top_issue_categories: topIssueCategories,
    screenshots,
    layout_metrics: layoutMetrics
  },
  correction: {
    axis,
    region: args.region || "unspecified",
    taste_profile: args.profile || args.tasteProfile || "balanced",
    severity: args.severity || "medium",
    human_note: args.note,
    preferred_traits: splitList(args.preferred || args.preferredTraits || ""),
    rejected_traits: splitList(args.rejected || args.rejectedTraits || "")
  },
  promotion: {
    candidate_for: splitList(args.candidateFor || "prompt_guidance,vision_judge_rubric"),
    deterministic_metric_candidate: args.deterministic === "1" || args.deterministic === "true",
    notes: args.promotionNotes || "Promote only after repeated corrections or expert confirmation."
  }
};

const datasetPath = args.dataset || "data/annotations/uxray-corrections.jsonl";
const recordPath = args.recordOut || `reports/annotations/${record.record_id}.json`;
await appendJsonl(datasetPath, record);
await writeJson(recordPath, record);
console.log(JSON.stringify({
  ok: true,
  record_id: record.record_id,
  axis: record.correction.axis,
  region: record.correction.region,
  dataset_path: datasetPath,
  record_path: recordPath,
  screenshots: screenshots.length,
  top_issue_categories: topIssueCategories
}, null, 2));
