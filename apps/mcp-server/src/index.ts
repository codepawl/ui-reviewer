#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { compareReviewReports, reviewUiUrl, type ReviewReport } from "../../../packages/reviewer-core/src/index.js";
import { captureUiUrl } from "../../../packages/renderer/src/index.js";
import { judgeRenderedUiWithVision } from "../../../packages/vision-adapter/src/index.js";

const UXRAY_VERSION = "0.3.1";
const UXRAY_CLOUD_API_BASE = (process.env.UXRAY_API_BASE || "https://useuxray.com").replace(/\/$/, "");
const UXRAY_API_KEY = process.env.UXRAY_API_KEY || "";
const UXRAY_CLOUD_MODE = process.env.UXRAY_CLOUD_MODE === "1" || Boolean(UXRAY_API_KEY);

function isLocalReviewUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname) || url.hostname.endsWith(".local");
  } catch {
    return false;
  }
}

async function hostedCloudReview(args: any) {
  if (!UXRAY_CLOUD_MODE || !UXRAY_API_KEY) return null;
  if (isLocalReviewUrl(args.url) && process.env.UXRAY_CLOUD_FORCE !== "1") return null;

  const response = await fetch(`${UXRAY_CLOUD_API_BASE}/v1/reviews/url`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${UXRAY_API_KEY}`
    },
    body: JSON.stringify({
      url: args.url,
      goal: args.goal,
      audience: args.audience,
      viewport: args.viewport,
      strictness: args.strictness,
      taste_profile: args.taste_profile,
      use_vision: args.use_vision,
      return_images: false
    })
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = { ok: false, error: "cloud_non_json_response", status: response.status, status_text: response.statusText };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            cloud_mode: true,
            cloud_api_base: UXRAY_CLOUD_API_BASE,
            status: response.status,
            ok: response.ok,
            ...((payload && typeof payload === "object") ? payload : { payload })
          },
          null,
          2
        )
      }
    ]
  };
}

const server = new McpServer({
  name: "uxray",
  version: UXRAY_VERSION
});

server.registerTool(
  "health_check",
  {
    title: "Health check",
    description: "Verify that the UXRay MCP server is reachable from the agent."
  },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            ok: true,
            service: "uxray",
            version: UXRAY_VERSION,
            stage: "uxray-brand-sync",
            cloud_mode: UXRAY_CLOUD_MODE,
            cloud_api_base: UXRAY_CLOUD_API_BASE,
            cloud_api_key_present: Boolean(UXRAY_API_KEY),
            tools: ["health_check", "check_update", "review_ui_url", "review_ui_diff"],
            update_command: "npm run check:update"
          },
          null,
          2
        )
      }
    ]
  })
);

server.registerTool(
  "check_update",
  {
    title: "Check for UXRay update",
    description: "Check the hosted UXRay update endpoint and return local upgrade/cancel commands for the user.",
    inputSchema: {
      current_version: z.string().optional().describe("Current local UXRay version. Defaults to the MCP server package version."),
      endpoint: z.string().url().optional().describe("Optional update endpoint override.")
    }
  },
  async (args) => {
    const currentVersion = args.current_version || UXRAY_VERSION;
    const endpoint = args.endpoint || "https://useuxray.com/v1/update";
    let payload: unknown;
    try {
      const response = await fetch(`${endpoint}?current=${encodeURIComponent(currentVersion)}&channel=stable`, { cache: "no-store" });
      payload = response.ok
        ? await response.json()
        : { ok: false, error: "update_check_failed", status: response.status, status_text: response.statusText };
    } catch (error) {
      payload = { ok: false, error: "update_check_failed", message: error instanceof Error ? error.message : String(error) };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              current_version: currentVersion,
              ...((payload && typeof payload === "object") ? payload : { payload }),
              local_options: {
                check: "npm run check:update",
                auto_upgrade: "npm run check:update -- --auto",
                cancel: "Do nothing or dismiss the update prompt."
              }
            },
            null,
            2
          )
        }
      ]
    };
  }
);

server.registerTool(
  "review_ui_url",
  {
    title: "Review UI URL",
    description:
      "Render a frontend URL in desktop/mobile Chrome, extract DOM context, save screenshots, and return structured UX issues plus repair guidance.",
    inputSchema: {
      url: z.string().url().describe("Local or remote URL for the frontend to review."),
      goal: z.string().min(1).describe("Product/user goal the UI is supposed to satisfy."),
      audience: z.string().optional().describe("Target audience or user persona."),
      viewport: z.array(z.string()).optional().describe("Viewport names to review, e.g. desktop and mobile."),
      strictness: z.enum(["low", "medium", "high"]).optional().describe("Review strictness level."),
      taste_profile: z.enum(["simplicity", "balanced", "complexity"]).optional().describe("Taste profile for subjective tradeoffs: simplicity, balanced, or complexity."),
      skip_render: z.boolean().optional().describe("If true, return a schema-only heuristic report without browser capture."),
      use_vision: z.boolean().optional().describe("If true, run a vision LLM judge over captured screenshots when OPENAI_API_KEY is configured."),
      vision_model: z.string().optional().describe("Optional OpenAI vision-capable model override, e.g. gpt-4o-mini."),
      return_images: z.boolean().optional().describe("If true, attach captured screenshots as MCP image content so the host model, e.g. Codex, can inspect them with its own login/session.")
    }
  },
  async (args) => {
    const hosted = await hostedCloudReview(args);
    if (hosted) return hosted;

    let rendered;
    let renderError: string | undefined;
    let vision;
    let visionError: string | undefined;

    const reviewInput = {
      url: args.url,
      goal: args.goal,
      audience: args.audience,
      viewport: args.viewport,
      strictness: args.strictness,
      taste_profile: args.taste_profile
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

    const response = {
      ...report,
      ...(renderError ? { render_error: renderError } : {}),
      ...(visionError ? { vision_error: visionError } : {}),
      assumptions: [
        ...(renderError ? [`Browser capture failed: ${renderError}`] : []),
        ...(visionError ? [`Vision judge failed: ${visionError}`] : []),
        ...report.assumptions
      ]
    };

    const content: any[] = [
      {
        type: "text",
        text: JSON.stringify(response, null, 2)
      }
    ];

    if (args.return_images && rendered) {
      content.push({
        type: "text",
        text: "Attached screenshots for host-model visual inspection. If you are Codex/Claude with vision, inspect these images and add visual UX issues that are not visible from DOM text alone."
      });
      for (const viewport of rendered.viewports) {
        const data = await readFile(viewport.screenshot_path, "base64");
        content.push({
          type: "image",
          data,
          mimeType: "image/png"
        });
      }
    }

    return { content };
  }
);

server.registerTool(
  "review_ui_diff",
  {
    title: "Review UI diff",
    description:
      "Compare two review_ui_url JSON reports and return a repair-loop scorecard for Codex, CI, or API consumers.",
    inputSchema: {
      before_report_path: z.string().min(1).describe("Path to the baseline review_ui_url JSON report."),
      after_report_path: z.string().min(1).describe("Path to the post-repair review_ui_url JSON report."),
      label: z.string().optional().describe("Optional human label for this comparison.")
    }
  },
  async (args) => {
    const before = JSON.parse(await readFile(args.before_report_path, "utf8")) as ReviewReport;
    const after = JSON.parse(await readFile(args.after_report_path, "utf8")) as ReviewReport;
    const diff = compareReviewReports(before, after);
    const response = {
      label: args.label ?? "review-ui-diff",
      before_report_path: args.before_report_path,
      after_report_path: args.after_report_path,
      ...diff
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
