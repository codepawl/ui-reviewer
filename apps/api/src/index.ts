#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { compareReviewReports, reviewUiUrl, type ReviewInput, type ReviewReport } from "../../../packages/reviewer-core/src/index.js";
import { captureUiUrl } from "../../../packages/renderer/src/index.js";
import { judgeRenderedUiWithVision } from "../../../packages/vision-adapter/src/index.js";

const PORT = Number.parseInt(process.env.PORT ?? "4317", 10);
const HOST = process.env.HOST ?? "127.0.0.1";
const UXRAY_VERSION = "0.3.1";

class BadReviewUrlError extends Error {
  statusCode = 400;
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (["localhost", "0.0.0.0", "127.0.0.1", "::1"].includes(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal") || host === "metadata.google.internal") return true;

  if (isIP(host)) {
    if (host.startsWith("10.") || host.startsWith("127.") || host.startsWith("169.254.")) return true;
    if (host.startsWith("192.168.")) return true;
    const parts = host.split(".").map((part) => Number.parseInt(part, 10));
    if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return true;
  }

  return false;
}

function assertPublicReviewUrl(rawUrl: string): void {
  const parsed = new URL(rawUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new BadReviewUrlError("Only http and https URLs can be reviewed.");
  }
  if (isPrivateHostname(parsed.hostname)) {
    throw new BadReviewUrlError("Hosted rendering cannot access localhost, private network, link-local, or metadata URLs.");
  }
}

function isAuthorized(request: IncomingMessage): boolean {
  const expected = process.env.RENDER_API_TOKEN;
  if (!expected) return true;
  return request.headers["x-uxray-render-token"] === expected;
}

function compareVersions(a: string, b: string): number {
  const left = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

const reviewUrlSchema = z.object({
  url: z.string().url(),
  goal: z.string().min(1),
  audience: z.string().optional(),
  viewport: z.array(z.string()).optional(),
  strictness: z.enum(["low", "medium", "high"]).optional(),
  skip_render: z.boolean().optional(),
  use_vision: z.boolean().optional(),
  vision_model: z.string().optional(),
  inline_screenshots: z.boolean().optional()
});

const reviewDiffSchema = z.object({
  before: z.custom<ReviewReport>((value) => typeof value === "object" && value !== null),
  after: z.custom<ReviewReport>((value) => typeof value === "object" && value !== null),
  label: z.string().optional()
});

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  response.end(JSON.stringify(payload, null, 2));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

async function handleReviewUrl(body: unknown): Promise<unknown> {
  const args = reviewUrlSchema.parse(body);
  if (process.env.UXRAY_REQUIRE_PUBLIC_URL === "true") {
    assertPublicReviewUrl(args.url);
  }
  let rendered;
  let renderError: string | undefined;
  let vision;
  let visionError: string | undefined;

  const reviewInput: ReviewInput = {
    url: args.url,
    goal: args.goal,
    audience: args.audience,
    viewport: args.viewport,
    strictness: args.strictness
  };

  if (!args.skip_render) {
    try {
      rendered = await captureUiUrl(args.url, { viewport: args.viewport });
    } catch (error) {
      renderError = error instanceof Error ? error.message : String(error);
    }
  }

  if (args.use_vision && rendered) {
    try {
      vision = await judgeRenderedUiWithVision(reviewInput, rendered, { model: args.vision_model });
    } catch (error) {
      visionError = error instanceof Error ? error.message : String(error);
    }
  }

  const report = reviewUiUrl(reviewInput, rendered, vision);
  if (args.inline_screenshots && report.rendered_context?.screenshots) {
    await Promise.all(report.rendered_context.screenshots.map(async (screenshot) => {
      try {
        const bytes = await readFile(screenshot.path);
        Object.assign(screenshot, {
          content_type: "image/png",
          data_base64: bytes.toString("base64")
        });
      } catch (error) {
        Object.assign(screenshot, {
          inline_error: error instanceof Error ? error.message : String(error)
        });
      }
    }));
  }
  return {
    ...report,
    ...(renderError ? { render_error: renderError } : {}),
    ...(visionError ? { vision_error: visionError } : {}),
    assumptions: [
      ...(renderError ? [`Browser capture failed: ${renderError}`] : []),
      ...(visionError ? [`Vision judge failed: ${visionError}`] : []),
      ...report.assumptions
    ]
  };
}

async function handleReviewDiff(body: unknown): Promise<unknown> {
  const args = reviewDiffSchema.parse(body);
  return {
    label: args.label ?? "api-review-diff",
    ...compareReviewReports(args.before, args.after)
  };
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);

    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    if (!isAuthorized(request) && requestUrl.pathname !== "/health") {
      sendJson(response, 401, { error: "unauthorized", message: "Missing or invalid render API token." });
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "ui-reviewer-api",
        version: UXRAY_VERSION,
        stage: "share-bookmark-update",
        endpoints: ["GET /health", "GET /v1/update", "POST /v1/reviews/url", "POST /v1/reviews/diff"]
      });
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/v1/update") {
      const currentVersion = requestUrl.searchParams.get("current") || "0.0.0";
      const updateAvailable = compareVersions(UXRAY_VERSION, currentVersion) > 0;
      sendJson(response, 200, {
        ok: true,
        product: "UXRay",
        channel: requestUrl.searchParams.get("channel") || "stable",
        current_version: currentVersion,
        latest_version: UXRAY_VERSION,
        update_available: updateAvailable,
        commands: {
          check: "npm run check:update",
          auto_upgrade: "npm run check:update -- --auto",
          upgrade: "npm run upgrade",
          cancel: "Dismiss the update prompt and keep the current local version."
        },
        release_notes: [
          "Share and bookmark actions are now interactive.",
          "Local installs can choose auto-upgrade or cancel from npm run check:update."
        ]
      });
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/v1/reviews/url") {
      sendJson(response, 200, await handleReviewUrl(await readJson(request)));
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/v1/reviews/diff") {
      sendJson(response, 200, await handleReviewDiff(await readJson(request)));
      return;
    }

    sendJson(response, 404, {
      error: "not_found",
      message: `No route for ${request.method ?? "GET"} ${request.url ?? "/"}`
    });
  } catch (error) {
    const statusCode = error instanceof z.ZodError ? 400 : error instanceof BadReviewUrlError ? error.statusCode : 500;
    sendJson(response, statusCode, {
      error: statusCode === 400 ? "bad_request" : "internal_error",
      message: error instanceof Error ? error.message : String(error),
      ...(error instanceof z.ZodError ? { issues: error.issues } : {})
    });
  }
});

server.listen(PORT, HOST, () => {
  console.error(`ui-reviewer-api listening on http://${HOST}:${PORT}`);
});
