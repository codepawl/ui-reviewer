#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { compareReviewReports, reviewUiUrl, type ReviewInput, type ReviewReport } from "../../../packages/reviewer-core/src/index.js";
import { captureUiUrl } from "../../../packages/renderer/src/index.js";
import { judgeRenderedUiWithVision } from "../../../packages/vision-adapter/src/index.js";

const PORT = Number.parseInt(process.env.PORT ?? "4317", 10);

const reviewUrlSchema = z.object({
  url: z.string().url(),
  goal: z.string().min(1),
  audience: z.string().optional(),
  viewport: z.array(z.string()).optional(),
  strictness: z.enum(["low", "medium", "high"]).optional(),
  skip_render: z.boolean().optional(),
  use_vision: z.boolean().optional(),
  vision_model: z.string().optional()
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
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "ui-reviewer-api",
        stage: "spike-006-api-wrapper",
        endpoints: ["GET /health", "POST /v1/reviews/url", "POST /v1/reviews/diff"]
      });
      return;
    }

    if (request.method === "POST" && request.url === "/v1/reviews/url") {
      sendJson(response, 200, await handleReviewUrl(await readJson(request)));
      return;
    }

    if (request.method === "POST" && request.url === "/v1/reviews/diff") {
      sendJson(response, 200, await handleReviewDiff(await readJson(request)));
      return;
    }

    sendJson(response, 404, {
      error: "not_found",
      message: `No route for ${request.method ?? "GET"} ${request.url ?? "/"}`
    });
  } catch (error) {
    const statusCode = error instanceof z.ZodError ? 400 : 500;
    sendJson(response, statusCode, {
      error: statusCode === 400 ? "bad_request" : "internal_error",
      message: error instanceof Error ? error.message : String(error),
      ...(error instanceof z.ZodError ? { issues: error.issues } : {})
    });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.error(`ui-reviewer-api listening on http://127.0.0.1:${PORT}`);
});
