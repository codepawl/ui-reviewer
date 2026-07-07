# UXRay MCP

Product-shaped experiment for UXRay, an MCP/API UI/UX review layer aimed at AI-generated frontends.

## Operating rules

- Keep the first vertical slice small: MCP tool, URL/screenshot input, structured JSON review output.
- Prefer measurable review-and-repair loops over generic design advice.
- Keep local-first UXRay review working before adding hosted/customer-facing integrations.
- For MVP, use LLM/vision adapters behind interfaces; do not fine-tune or train a model yet.

## Success metric for the first spike

Codex can call the local MCP server and receive a structured `review_ui_url` report that it can use as repair instructions.
