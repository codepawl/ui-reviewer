#!/usr/bin/env node
import assert from "node:assert/strict";
import { extractHtml, generateHtmlWithDeepInfra, requestPayloadForRun } from "./lib/deepinfra-generator.mjs";

const run = {
  run_id: "landing_ai_code_review__taste_context",
  generator_prompt: "Generate a taste-aware UI",
  expected_artifacts: { html_path: "reports/taste-benchmark/landing_ai_code_review/taste_context/index.html" }
};

assert.equal(extractHtml("```html\n<!doctype html><html><body>ok</body></html>\n```"), "<!doctype html><html><body>ok</body></html>");
assert.equal(extractHtml("text before <html><body>ok</body></html> text after"), "<html><body>ok</body></html>");

const payload = requestPayloadForRun(run, { model: "test/model" });
assert.equal(payload.model, "test/model");
assert.equal(payload.messages[0].role, "system");
assert.match(payload.messages[1].content, /Generate a taste-aware UI/);
assert.equal(payload.temperature, 0.25);

let captured;
const html = await generateHtmlWithDeepInfra(run, {
  apiKey: "test-key",
  model: "test/model",
  fetchImpl: async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      status: 200,
      async json() {
        return { choices: [{ message: { content: "```html\n<!doctype html><html><body>generated</body></html>\n```" } }] };
      }
    };
  }
});
assert.equal(captured.url, "https://api.deepinfra.com/v1/openai/chat/completions");
assert.equal(captured.options.headers.authorization, "Bearer test-key");
assert.equal(html, "<!doctype html><html><body>generated</body></html>");

await assert.rejects(() => generateHtmlWithDeepInfra(run, { apiKey: "" }), /DEEPINFRA_API_KEY/);
console.log("deepinfra generator tests passed");
