export const DEEPINFRA_CHAT_COMPLETIONS_URL = "https://api.deepinfra.com/v1/openai/chat/completions";
export const DEFAULT_DEEPINFRA_MODEL = "Qwen/Qwen3-Coder-480B-A35B-Instruct";

export function extractHtml(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const doctypeIndex = candidate.toLowerCase().indexOf("<!doctype html");
  if (doctypeIndex >= 0) return candidate.slice(doctypeIndex).trim();
  const htmlStart = candidate.toLowerCase().indexOf("<html");
  const htmlEnd = candidate.toLowerCase().lastIndexOf("</html>");
  if (htmlStart >= 0 && htmlEnd >= htmlStart) return candidate.slice(htmlStart, htmlEnd + "</html>".length).trim();
  return candidate;
}

export function requestPayloadForRun(run, { model = DEFAULT_DEEPINFRA_MODEL, temperature = 0.25, maxTokens = 6500 } = {}) {
  return {
    model,
    temperature: Number(temperature),
    max_tokens: Number(maxTokens),
    messages: [
      {
        role: "system",
        content: [
          "You generate single-file responsive HTML/CSS UI benchmark artifacts for UXRay.",
          "Return only one complete HTML document. Do not include Markdown commentary.",
          "Use inline CSS. Do not load external assets, fonts, scripts, analytics, or CDNs.",
          "Make all links/buttons harmless href anchors. Preserve the product task and route type.",
          "Avoid fake customer logos, fake benchmark numbers, and unverifiable claims unless the prompt explicitly asks for a bad baseline."
        ].join("\n")
      },
      {
        role: "user",
        content: run.generator_prompt
      }
    ]
  };
}

export async function generateHtmlWithDeepInfra(run, options = {}) {
  const apiKey = options.apiKey ?? process.env.DEEPINFRA_API_KEY;
  if (!apiKey) throw new Error("DEEPINFRA_API_KEY is required to generate benchmark HTML with DeepInfra.");
  const endpoint = options.endpoint || process.env.DEEPINFRA_BASE_URL || DEEPINFRA_CHAT_COMPLETIONS_URL;
  const fetchImpl = options.fetchImpl || fetch;
  const payload = requestPayloadForRun(run, options);
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
  let body;
  try {
    body = await response.json();
  } catch (error) {
    throw new Error(`DeepInfra returned non-JSON response (${response.status}): ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    throw new Error(`DeepInfra request failed (${response.status}): ${JSON.stringify(body).slice(0, 1000)}`);
  }
  const content = body?.choices?.[0]?.message?.content ?? body?.choices?.[0]?.text;
  if (!content) throw new Error(`DeepInfra response did not contain message content: ${JSON.stringify(body).slice(0, 1000)}`);
  const html = extractHtml(content);
  if (!/<html[\s>]/i.test(html) && !/<!doctype html/i.test(html)) {
    throw new Error("DeepInfra response did not contain a complete HTML document.");
  }
  return html;
}
