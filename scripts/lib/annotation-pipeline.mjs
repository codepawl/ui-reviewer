import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";

export const SCHEMA_VERSION = "uxray.preference.v1";
export const VALID_AXES = new Set(["spacing_rhythm", "hierarchy", "density", "cta_clarity", "card_balance", "simplicity_vs_complexity", "overall_taste", "custom"]);
export const VALID_PROFILES = new Set(["simplicity", "balanced", "complexity", "mixed"]);

export function stableId(prefix, value) {
  return `${prefix}_${createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 14)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

export async function appendJsonl(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(value)}\n`);
  return filePath;
}

export function normalizeProfile(value = "balanced") {
  const profile = String(value || "balanced").toLowerCase();
  return VALID_PROFILES.has(profile) ? profile : "balanced";
}

export function normalizeAxis(value = "overall_taste") {
  const axis = String(value || "overall_taste").toLowerCase();
  return VALID_AXES.has(axis) ? axis : "custom";
}

export function buildPairwiseTask(input = {}) {
  const axis = normalizeAxis(input.axis);
  const targetProfile = normalizeProfile(input.target_profile || input.profile);
  const prompt = input.prompt || defaultPrompt(axis, targetProfile);
  const taskSeed = {
    axis,
    prompt,
    target_profile: targetProfile,
    a: input.a,
    b: input.b,
    route_type: input.route_type || "unknown"
  };
  return {
    schema_version: SCHEMA_VERSION,
    task_id: input.task_id || stableId("task", taskSeed),
    created_at: input.created_at || nowIso(),
    axis,
    prompt,
    route_type: input.route_type || "unknown",
    target_profile: targetProfile,
    artifacts: {
      a: normalizeArtifact(input.a, "A"),
      b: normalizeArtifact(input.b, "B")
    },
    context: input.context || {},
    metrics_before_label: input.metrics_before_label || {},
    publication: input.publication || {
      platform: "x",
      status: "draft_only"
    }
  };
}

function normalizeArtifact(value, label) {
  const artifact = typeof value === "object" && value ? value : { label: String(value || label) };
  return {
    label: artifact.label || label,
    screenshot_url: artifact.screenshot_url || artifact.image_url || undefined,
    screenshot_path: artifact.screenshot_path || undefined,
    route_url: artifact.route_url || undefined,
    viewport: artifact.viewport || undefined,
    metrics: artifact.metrics || {},
    notes: artifact.notes || undefined
  };
}

export function defaultPrompt(axis, profile) {
  const profileText = profile === "simplicity"
    ? "cleaner and easier to scan"
    : profile === "complexity"
      ? "more informative without feeling crowded"
      : "better balanced for real users";
  const axisText = axis.replace(/_/g, " ");
  return `Which UI feels ${profileText} for ${axisText}?`;
}

export function buildXPollDraft(task) {
  const urlA = task.artifacts.a.screenshot_url || task.artifacts.a.route_url || "A screenshot/link";
  const urlB = task.artifacts.b.screenshot_url || task.artifacts.b.route_url || "B screenshot/link";
  const text = [
    "help train UXRay's UI taste model",
    "",
    task.prompt,
    "",
    `A: ${task.artifacts.a.label}`,
    `B: ${task.artifacts.b.label}`,
    "",
    urlA === urlB ? urlA : `${urlA}\n${urlB}`,
    "",
    "poll below: A / B / tie"
  ].join("\n");
  return {
    platform: "x",
    task_id: task.task_id,
    text,
    poll_options: ["A", "B", "tie / depends"],
    duration_hours: 24,
    safety: {
      publish_status: "draft_only",
      notes: "Post only after a human approves the exact text/media. Ingest aggregate poll counts only; do not store voter identities."
    }
  };
}

export function buildPollAnnotation({ task, post_id, post_url, counts, duration_hours = 24, audience_notes = "public X poll", human_note = "" }) {
  const raw = {
    a: Number.parseInt(counts.a ?? 0, 10) || 0,
    b: Number.parseInt(counts.b ?? 0, 10) || 0,
    tie: Number.parseInt(counts.tie ?? 0, 10) || 0,
    other: Number.parseInt(counts.other ?? 0, 10) || 0
  };
  const sample = raw.a + raw.b + raw.tie + raw.other;
  const distribution = sample > 0
    ? Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Number((value / sample).toFixed(4))]))
    : { a: 0, b: 0, tie: 0, other: 0 };
  const top = raw.a === raw.b ? "tie" : raw.a > raw.b ? "a" : "b";
  const margin = sample > 0 ? Math.abs(raw.a - raw.b) / sample : 0;
  const winner = sample < 20 || margin < 0.08 ? "unclear" : top;
  const confidence = Number(Math.min(1, Math.max(0, margin * Math.log10(Math.max(10, sample)))).toFixed(3));
  const pairwiseLabel = winner === "a" ? "a_preferred" : winner === "b" ? "b_preferred" : winner;
  return {
    schema_version: SCHEMA_VERSION,
    record_id: stableId("pref", { task_id: task.task_id, post_id, raw }),
    created_at: nowIso(),
    task: {
      task_id: task.task_id,
      axis: task.axis,
      prompt: task.prompt,
      route_type: task.route_type,
      target_profile: task.target_profile,
      artifacts: task.artifacts,
      context: task.context,
      metrics_before_label: task.metrics_before_label
    },
    source: {
      kind: "x_poll",
      platform: "x",
      post_id: post_id || null,
      post_url: post_url || null,
      poll_duration_hours: Number(duration_hours),
      sample_size: sample,
      audience_notes
    },
    choice: {
      winner,
      confidence,
      distribution,
      raw_counts: raw
    },
    labels: {
      preferred_traits: inferPreferredTraits(task.axis, winner),
      rejected_traits: inferRejectedTraits(task.axis, winner),
      taste_profile_signal: task.target_profile || "unknown",
      human_note
    },
    derived_targets: {
      hard_filter_updates: deriveHardFilterTargets(task.axis, winner, confidence),
      model_training: {
        pairwise_label: pairwiseLabel,
        reward_score: winner === "a" ? 1 : winner === "b" ? -1 : 0,
        feature_tags: [task.axis, task.route_type, task.target_profile].filter(Boolean),
        constraint_tags: ["pairwise_public_poll", sample < 50 ? "low_sample" : "public_preference"]
      }
    }
  };
}

function inferPreferredTraits(axis, winner) {
  if (winner === "unclear") return ["ambiguous_public_preference"];
  if (axis === "spacing_rhythm") return ["clearer_vertical_rhythm", "less_clipped_followup_text"];
  if (axis === "simplicity_vs_complexity") return ["chosen_taste_profile_match"];
  if (axis === "density") return ["better_information_density"];
  if (axis === "hierarchy") return ["stronger_primary_hierarchy"];
  return ["public_pairwise_preferred"];
}

function inferRejectedTraits(axis, winner) {
  if (winner === "unclear" || winner === "tie") return [];
  if (axis === "spacing_rhythm") return ["tight_or_accidental_spacing"];
  if (axis === "density") return ["crowded_or_underexplained_region"];
  if (axis === "hierarchy") return ["weak_or_flat_hierarchy"];
  return ["less_preferred_variant"];
}

function deriveHardFilterTargets(axis, winner, confidence) {
  if (winner === "unclear" || confidence < 0.18) return [{ metric: axis, direction: "ignore", rationale: "Public signal too weak; keep as model-training context only." }];
  if (axis === "spacing_rhythm") return [{ metric: "tight_block_spacing_count", direction: "increase_weight", rationale: "Public preference favored looser block-to-text rhythm." }];
  if (axis === "density") return [{ metric: "crowded_region_count", direction: "increase_weight", rationale: "Public preference indicates density matters for this route/profile." }];
  if (axis === "hierarchy") return [{ metric: "weak_primary_card_text_count", direction: "increase_weight", rationale: "Public preference favored stronger scan hierarchy." }];
  return [{ metric: axis, direction: "new_metric", rationale: "Repeated labels should be clustered before changing deterministic filters." }];
}

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    out[key] = next && !next.startsWith("--") ? next : "1";
    if (next && !next.startsWith("--")) i += 1;
  }
  return out;
}
