# UI Reviewer MCP

Product-shaped experiment for an MCP/API UI/UX review layer aimed at AI-generated frontends.

## Operating rules

- Keep the first vertical slice small: MCP tool, URL/screenshot input, structured JSON review output.
- Prefer measurable review-and-repair loops over generic design advice.
- Do not add hosted billing/auth or customer-facing integrations until the local Codex demo works.
- For MVP, use LLM/vision adapters behind interfaces; do not fine-tune or train a model yet.

## Success metric for the first spike

Codex can call the local MCP server and receive a structured `review_ui_url` report that it can use as repair instructions.
