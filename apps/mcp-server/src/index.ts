#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { compareReviewReports, reviewUiUrl, type ReviewReport } from "../../../packages/reviewer-core/src/index.js";
import { captureUiUrl } from "../../../packages/renderer/src/index.js";
import { judgeRenderedUiWithVision } from "../../../packages/vision-adapter/src/index.js";

const server = new McpServer({
  name: "ui-reviewer",
  version: "0.3.0"
});

server.registerTool(
  "health_check",
  {
    title: "Health check",
    description: "Verify that the UI Reviewer MCP server is reachable from the agent."
  },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            ok: true,
            service: "ui-reviewer",
            stage: "spike-005-review-diff",
            tools: ["health_check", "review_ui_url", "review_ui_diff"]
          },
          null,
          2
        )
      }
    ]
  })
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
      skip_render: z.boolean().optional().describe("If true, return a schema-only heuristic report without browser capture."),
      use_vision: z.boolean().optional().describe("If true, run a vision LLM judge over captured screenshots when OPENAI_API_KEY is configured."),
      vision_model: z.string().optional().describe("Optional OpenAI vision-capable model override, e.g. gpt-4o-mini."),
      return_images: z.boolean().optional().describe("If true, attach captured screenshots as MCP image content so the host model, e.g. Codex, can inspect them with its own login/session.")
    }
  },
  async (args) => {
    let rendered;
    let renderError: string | undefined;
    let vision;
    let visionError: string | undefined;

    const reviewInput = {
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
