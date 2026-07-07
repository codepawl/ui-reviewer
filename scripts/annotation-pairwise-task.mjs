#!/usr/bin/env node
import path from "node:path";
import { buildPairwiseTask, buildXPollDraft, parseArgs, writeJson } from "./lib/annotation-pipeline.mjs";

const args = parseArgs(process.argv.slice(2));
const task = buildPairwiseTask({
  axis: args.axis || process.env.PAIRWISE_AXIS || "spacing_rhythm",
  profile: args.profile || process.env.PAIRWISE_PROFILE || "balanced",
  route_type: args.routeType || process.env.PAIRWISE_ROUTE_TYPE || "docs",
  prompt: args.prompt || process.env.PAIRWISE_PROMPT,
  a: {
    label: args.aLabel || process.env.PAIRWISE_A_LABEL || "A",
    screenshot_url: args.aImage || process.env.PAIRWISE_A_IMAGE,
    route_url: args.aUrl || process.env.PAIRWISE_A_URL,
    notes: args.aNotes || process.env.PAIRWISE_A_NOTES
  },
  b: {
    label: args.bLabel || process.env.PAIRWISE_B_LABEL || "B",
    screenshot_url: args.bImage || process.env.PAIRWISE_B_IMAGE,
    route_url: args.bUrl || process.env.PAIRWISE_B_URL,
    notes: args.bNotes || process.env.PAIRWISE_B_NOTES
  },
  context: {
    source: "uxray_pairwise_task_cli",
    publish_gate: "manual_approval_required",
    requested_by: args.requestedBy || "local"
  }
});

const draft = buildXPollDraft(task);
const taskPath = args.taskOut || path.join("data", "annotations", "tasks", `${task.task_id}.json`);
const draftPath = args.draftOut || path.join("reports", "annotations", `${task.task_id}.x-poll-draft.json`);
await writeJson(taskPath, task);
await writeJson(draftPath, draft);
console.log(JSON.stringify({ ok: true, task_id: task.task_id, task_path: taskPath, draft_path: draftPath, poll_text: draft.text, poll_options: draft.poll_options }, null, 2));
