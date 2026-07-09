#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { parseArgs, readJson } from "./lib/annotation-pipeline.mjs";

const args = parseArgs(process.argv.slice(2));
const profileId = args.profile || "technical_premium";
const routeType = args.routeType || "unknown";
const limit = Math.max(1, Number.parseInt(args.limit || "8", 10) || 8);
const profilesPath = args.profiles || "data/annotations/taste-profiles.json";
const preferencePath = args.preferences || "data/annotations/uxray-preference-events.jsonl";
const correctionPath = args.corrections || "data/annotations/uxray-corrections.jsonl";

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonl(filePath) {
  if (!(await fileExists(filePath))) return [];
  const text = await readFile(filePath, "utf8");
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

const profiles = await readJson(profilesPath);
const profile = profiles[profileId];
if (!profile) {
  console.error(`Unknown taste profile: ${profileId}. Available: ${Object.keys(profiles).join(", ")}`);
  process.exit(2);
}

const preferences = (await readJsonl(preferencePath))
  .filter((record) => !profileId || record.task?.target_profile === profileId || record.labels?.taste_profile_signal === profileId || profileId === "technical_premium" && record.task?.target_profile === "balanced")
  .filter((record) => routeType === "unknown" || record.task?.route_type === routeType || !record.task?.route_type)
  .slice(-limit)
  .reverse();
const corrections = (await readJsonl(correctionPath))
  .filter((record) => !profileId || record.correction?.taste_profile === profileId)
  .filter((record) => routeType === "unknown" || record.review?.route_type === routeType || true)
  .slice(-limit)
  .reverse();

const learnedPrefer = unique(preferences.flatMap((record) => record.labels?.preferred_traits || []).concat(corrections.flatMap((record) => record.correction?.preferred_traits || []))).slice(0, limit);
const learnedAvoid = unique(preferences.flatMap((record) => record.labels?.rejected_traits || []).concat(corrections.flatMap((record) => record.correction?.rejected_traits || []))).slice(0, limit);
const humanNotes = unique(preferences.map((record) => record.labels?.human_note).concat(corrections.map((record) => record.correction?.human_note))).slice(0, limit);

const lines = [];
lines.push(`Taste profile: ${profileId}`);
lines.push(`Base UXRay profile: ${profile.base_profile || "balanced"}`);
if (profile.description) lines.push(`Description: ${profile.description}`);
lines.push("");
lines.push("Prefer:");
for (const item of profile.prefer || []) lines.push(`- ${item}`);
for (const item of learnedPrefer) if (!(profile.prefer || []).includes(item)) lines.push(`- ${item} (learned)`);
lines.push("");
lines.push("Avoid:");
for (const item of profile.avoid || []) lines.push(`- ${item}`);
for (const item of learnedAvoid) if (!(profile.avoid || []).includes(item)) lines.push(`- ${item} (learned)`);
if (humanNotes.length) {
  lines.push("");
  lines.push("Recent human preference notes:");
  for (const note of humanNotes) lines.push(`- ${note}`);
}
lines.push("");
lines.push("Generator instruction: create distinct design strategies, preserve the selected taste traits, and fix hard UXRay failures without adding decorative complexity or generic SaaS filler.");

const payload = {
  ok: true,
  profile_id: profileId,
  route_type: routeType,
  preference_records: preferences.length,
  correction_records: corrections.length,
  context: lines.join("\n")
};

if (args.json === "1" || args.json === "true") {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log(payload.context);
}
