import { compareReviewReports } from "../../../packages/reviewer-core/src/index.js";

type D1StatementLike = {
  bind: (...values: unknown[]) => {
    run: () => Promise<unknown>;
    first: <T = unknown>() => Promise<T | null>;
    all: <T = unknown>() => Promise<{ results?: T[] }>;
  };
};

type D1DatabaseLike = {
  prepare: (query: string) => D1StatementLike;
};

type R2ObjectLike = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  writeHttpMetadata?: (headers: Headers) => void;
};

type R2BucketLike = {
  put: (key: string, value: ArrayBuffer | string | ReadableStream, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }) => Promise<unknown>;
  get: (key: string) => Promise<R2ObjectLike | null>;
};

type HostedReport = Record<string, unknown> & {
  report_id?: string;
  report_url?: string;
  share_url?: string;
  saved?: boolean;
  score?: number;
  verdict?: string;
  reviewed_url?: string;
  rendered_context?: {
    title?: string;
    final_url?: string;
    captured_at?: string;
    screenshots?: Array<Record<string, unknown> & { name?: string; path?: string; data_base64?: string; content_type?: string }>;
  };
};

type ReportSummaryRow = {
  id: string;
  reviewed_url: string;
  title: string;
  score: number | null;
  verdict: string;
  screenshot_count: number;
  created_at: string;
};

type DashboardTotals = {
  report_count: number;
  screenshot_count: number;
  average_score: number;
  latest_report_at: string | null;
};

type Env = {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  DB?: D1DatabaseLike;
  REPORTS?: R2BucketLike;
  CREEM_API_KEY?: string;
  CREEM_API_BASE?: string;
  RENDER_API_BASE?: string;
  RENDER_API_TOKEN?: string;
};

const UXRAY_VERSION = "0.3.1";

const CREEM_PRODUCTS = {
  pro: "prod_1jC5aZ17L5Gcg2DLvPGRsm",
  team: "prod_7BsaI9cntwy4eGvyZ9jYPp",
  credits: "prod_4umYAfrnQ3BktOxLwgcMwX"
} as const;

function compareVersions(a: string, b: string): number {
  const left = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function creemCheckoutUrl(plan: keyof typeof CREEM_PRODUCTS = "pro"): string {
  return `https://creem.io/payment/${CREEM_PRODUCTS[plan]}?theme=dark`;
}

type BillingPlan = keyof typeof CREEM_PRODUCTS;

function normalizePlan(value: string | null | undefined): BillingPlan {
  const lowered = String(value || "pro").toLowerCase();
  if (lowered.includes("team")) return "team";
  if (lowered.includes("credit")) return "credits";
  return "pro";
}

function successUrl(origin: string, plan: BillingPlan): string {
  const url = new URL("/account.html", origin);
  url.searchParams.set("checkout", "success");
  url.searchParams.set("plan", plan);
  return url.toString();
}

async function createCreemCheckout(env: Env, origin: string, plan: BillingPlan, email?: string | null): Promise<string | null> {
  if (!env.CREEM_API_KEY) return null;

  const apiBase = env.CREEM_API_BASE || "https://test-api.creem.io";
  const payload: Record<string, unknown> = {
    product_id: CREEM_PRODUCTS[plan],
    units: 1,
    success_url: successUrl(origin, plan),
    metadata: {
      product: "uxray",
      plan,
      source: "useuxray.com"
    }
  };
  if (email) payload.customer = { email };

  const response = await fetch(`${apiBase.replace(/\/$/, "")}/v1/checkouts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.CREEM_API_KEY
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return null;
  }

  const checkout = await response.json() as { checkout_url?: string };
  return typeof checkout.checkout_url === "string" ? checkout.checkout_url : null;
}

const demoReport = {
  product: "UXRay",
  stage: "cloudflare-demo",
  summary: "UI Reviewer found major UX/layout failures in three AI-generated frontend fixtures, Codex repaired them using MCP screenshots and structured issues, and the eval score improved from 39 to 100.",
  metrics: {
    average_score_before: 39,
    average_score_after: 100,
    score_delta: 61,
    total_issues_before: 11,
    total_issues_after: 0,
    high_severity_before: 9,
    high_severity_after: 0,
    fixtures_improved: "3/3"
  },
  evidence: {
    source: "reports/evals/spike-007",
    fairness: "same fixture family, same local reviewer, same viewport contract, same repair-loop prompt style",
    showcased_fixture: "landing-chaos",
    showcased_score_before: 46,
    showcased_score_after: 100,
    images: {
      before: "/assets/evidence/landing-before.webp",
      after: "/assets/evidence/landing-after.webp"
    },
    gallery: {
      landing_chaos: ["/assets/evidence/landing-before.webp", "/assets/evidence/landing-after.webp"],
      dashboard_density: ["/assets/evidence/dashboard-before.webp", "/assets/evidence/dashboard-after.webp"],
      onboarding_form: ["/assets/evidence/onboarding-before.webp", "/assets/evidence/onboarding-after.webp"]
    }
  },
  fixtures: [
    {
      id: "landing-chaos",
      score_before: 46,
      score_after: 100,
      fixed_categories: ["intent_fit", "responsive", "task_flow"]
    },
    {
      id: "dashboard-density",
      score_before: 36,
      score_after: 100,
      fixed_categories: ["information_hierarchy", "intent_fit", "responsive", "task_flow"]
    },
    {
      id: "onboarding-form",
      score_before: 36,
      score_after: 100,
      fixed_categories: ["intent_fit", "responsive", "state_completeness", "task_flow"]
    }
  ],
  next_scenarios: [
    "pricing-table-overload",
    "settings-maze",
    "empty-state-dead-end",
    "mobile-cta-collapse",
    "modal-friction",
    "docs-quickstart-gap",
    "ai-app-builder-page"
  ],
  note: "Hosted Cloudflare surface exposes the demo and API-shaped endpoints. Full URL rendering uses local MCP/Playwright because standard Workers cannot run local Chrome."
};

const installGuide = {
  product: "UXRay",
  version: UXRAY_VERSION,
  docs: "/docs.html",
  recommended_local_demo: "npm run demo:pipeline",
  github: "https://github.com/codepawl/ui-reviewer",
  agents: {
    codex: {
      command: "codex mcp add uxray -- npm --prefix /absolute/path/to/uxray run mcp",
      prompt: "Auto-trigger UXRay for generated frontend review/repair tasks. Call health_check, then review_ui_url with return_images=true, viewport desktop+mobile, strictness high, inspect screenshots, repair only repair_plan items, rerun review_ui_url, then compare reports."
    },
    claude_code: {
      command: "claude mcp add uxray -- npm --prefix /absolute/path/to/uxray run mcp",
      prompt: "Use the uxray MCP server to review my local frontend URL, apply the structured repair instructions, and rerun the review."
    },
    local_api: {
      command: "npm run api",
      health: "curl http://127.0.0.1:4317/health"
    },
    skill: {
      url: "https://useuxray.com/plugins/uxray-agent-skill.md",
      command: "curl -fsSL https://useuxray.com/plugins/uxray-agent-skill.md -o ~/.config/uxray/skills/uxray-agent-skill.md",
      purpose: "Teaches agents when to auto-trigger UXRay, the exact review -> screenshot inspection -> repair_plan -> diff loop, and how to avoid vague UI beautification."
    }
  },
  pricing: {
    local: "$0 local MCP",
    pro: "$19/mo hosted review credits",
    team: "$99/mo CI, reports, and rule packs",
    checkout: "/v1/billing/checkout",
    provider: "Creem",
    creem_products: CREEM_PRODUCTS,
    live_payments_note: "Creem checkout sessions are created through the Creem API when CREEM_API_KEY is configured; direct payment links remain as fallback."
  },
  updates: {
    endpoint: "/v1/update",
    check_command: "npm run check:update",
    auto_upgrade_command: "npm run check:update -- --auto",
    upgrade_command: "npm run upgrade"
  },
  hosted_note: "Cloudflare hosts the landing/docs/static demo API. URL rendering needs a browser-capable local or hosted runtime."
};

const advancedFeatureBets = [
  {
    name: "Agent CI Firewall",
    category: "AI infra",
    stage: "money bet",
    price_anchor: "$99-$499/mo per repo",
    description: "Runs UXRay on every preview deploy, blocks PRs with high-severity UX regressions, and gives agents a repair contract with screenshots instead of generic lint text.",
    why_it_can_charge: "Teams already pay for CI gates; this turns UI quality into an enforceable agent workflow gate."
  },
  {
    name: "UX Regression Memory",
    category: "product intelligence",
    stage: "differentiated",
    price_anchor: "$199/mo+ for teams",
    description: "Learns each route/component's historical UX score, recurring failure modes, screenshots, and repair deltas so teams can detect slow design decay over time.",
    why_it_can_charge: "Most tools snapshot bugs. This tracks whether AI agents repeatedly recreate the same UX debt."
  },
  {
    name: "Conversion Friction Simulator",
    category: "growth",
    stage: "premium report",
    price_anchor: "$49-$299/report",
    description: "Simulates buyer personas walking the page, maps hesitation points to screenshot regions, then ranks fixes by likely conversion impact.",
    why_it_can_charge: "Founders will pay more for revenue-linked UX findings than for design taste comments."
  },
  {
    name: "Agent Repair Arena",
    category: "agent ops",
    stage: "moat",
    price_anchor: "usage-based",
    description: "Runs multiple coding agents against the same UXRay report, scores before/after objectively, and promotes the best repair patch.",
    why_it_can_charge: "Turns model choice into measurable UI repair performance, not vibes."
  },
  {
    name: "Design Debt Ledger",
    category: "exec dashboard",
    stage: "team upsell",
    price_anchor: "$299/mo+",
    description: "Translates recurring UX issues into route-level debt, owner, estimated lost funnel value, and next repair task for agents.",
    why_it_can_charge: "Execs do not buy screenshots; they buy prioritized debt tied to customer friction."
  },
  {
    name: "Competitor Shadow Review",
    category: "market intelligence",
    stage: "premium add-on",
    price_anchor: "$99/report",
    description: "Compares your page against competitor screenshots for the same buyer task and produces a repair plan to close clarity, trust, and flow gaps.",
    why_it_can_charge: "It makes UXRay feel like product strategy, not just QA."
  }
];

function achievementsFor(totals: DashboardTotals) {
  const reportCount = totals.report_count;
  const screenshotCount = totals.screenshot_count;
  return [
    { name: "First Ray", status: reportCount >= 1 ? "unlocked" : "locked", progress: Math.min(reportCount, 1), target: 1, description: "Create the first hosted UXRay report." },
    { name: "Proof Keeper", status: reportCount >= 3 ? "unlocked" : "active", progress: Math.min(reportCount, 3), target: 3, description: "Save 3 durable reports with share links." },
    { name: "Evidence Vault", status: screenshotCount >= 3 ? "unlocked" : "active", progress: Math.min(screenshotCount, 3), target: 3, description: "Persist 3 screenshots into R2 evidence storage." },
    { name: "Sharp Gate", status: totals.average_score >= 80 ? "unlocked" : "active", progress: Math.max(0, Math.min(Math.round(totals.average_score), 80)), target: 80, description: "Reach an average report score of 80+." },
    { name: "Repair Loop", status: "locked", progress: 0, target: 1, description: "Run before/after review_ui_diff and save the improvement." },
    { name: "CI Sentinel", status: "locked", progress: 0, target: 1, description: "Connect UXRay to a preview deploy or PR gate." }
  ];
}

async function accountDashboard(env: Env) {
  const emptyTotals: DashboardTotals = { report_count: 0, screenshot_count: 0, average_score: 0, latest_report_at: null };
  if (!env.DB) {
    return {
      ok: true,
      status: "account_shell_only",
      account_enabled: false,
      totals: emptyTotals,
      usage: { plan: "Pro shell", monthly_credits: 100, credits_used: 0, credits_remaining: 100, render_worker: "configured" },
      recent_reports: [],
      achievements: achievementsFor(emptyTotals),
      advanced_features: advancedFeatureBets
    };
  }

  const totalsRow = await env.DB.prepare(`SELECT COUNT(*) AS report_count, COALESCE(SUM(screenshot_count), 0) AS screenshot_count, COALESCE(ROUND(AVG(score), 1), 0) AS average_score, MAX(created_at) AS latest_report_at FROM reports`)
    .bind()
    .first<DashboardTotals>();
  const totals = totalsRow || emptyTotals;
  const recent = await env.DB.prepare(`SELECT id, reviewed_url, title, score, verdict, screenshot_count, created_at FROM reports ORDER BY created_at DESC LIMIT 5`)
    .bind()
    .all<ReportSummaryRow>();
  const recentReports = (recent.results || []).map((report) => ({
    ...report,
    report_url: `/r/${report.id}`,
    api_url: `/v1/reports/${report.id}`
  }));
  const monthlyCredits = 100;
  const creditsUsed = Math.min(Number(totals.report_count || 0), monthlyCredits);

  return {
    ok: true,
    status: "dashboard_shell_live_metrics",
    account_enabled: false,
    account_note: "Auth/session is not enabled yet. This dashboard uses global hosted report metrics until user accounts and entitlements are wired.",
    totals,
    usage: {
      plan: "Pro shell",
      monthly_credits: monthlyCredits,
      credits_used: creditsUsed,
      credits_remaining: monthlyCredits - creditsUsed,
      hosted_reports: totals.report_count,
      persisted_screenshots: totals.screenshot_count,
      render_worker: "Fly.io auto-start",
      storage: "Cloudflare D1 + R2"
    },
    recent_reports: recentReports,
    achievements: achievementsFor(totals),
    advanced_features: advancedFeatureBets
  };
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}

function redirect(location: string, status = 303): Response {
  return new Response(null, {
    status,
    headers: {
      location,
      "cache-control": "no-store"
    }
  });
}

function html(markup: string, status = 200): Response {
  return new Response(markup, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60"
    }
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function safeObjectPart(value: unknown, fallback: string): string {
  const clean = String(value || fallback).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "");
  return clean || fallback;
}

async function loadReport(env: Env, id: string): Promise<HostedReport | null> {
  if (!env.REPORTS || !/^[a-z0-9-]{8,64}$/i.test(id)) return null;
  const object = await env.REPORTS.get(`reports/${id}/report.json`);
  if (!object) return null;
  return await new Response(object.body).json() as HostedReport;
}

async function persistHostedReport(payload: HostedReport, env: Env, origin: string): Promise<HostedReport> {
  if (!env.REPORTS || !payload.rendered_context) return payload;

  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const screenshots = payload.rendered_context.screenshots || [];
  let screenshotCount = 0;

  for (let index = 0; index < screenshots.length; index += 1) {
    const screenshot = screenshots[index];
    const dataBase64 = screenshot.data_base64;
    delete screenshot.data_base64;

    if (!dataBase64) continue;
    const name = safeObjectPart(screenshot.name, `viewport-${index + 1}`);
    const extension = screenshot.content_type === "image/jpeg" ? "jpg" : "png";
    const filename = `${name}.${extension}`;
    const key = `reports/${id}/screenshots/${filename}`;
    await env.REPORTS.put(key, base64ToArrayBuffer(dataBase64), {
      httpMetadata: { contentType: screenshot.content_type || "image/png" },
      customMetadata: { report_id: id, viewport: name }
    });
    screenshot.path = `/v1/reports/${id}/screenshots/${filename}`;
    screenshot.screenshot_url = `${origin}/v1/reports/${id}/screenshots/${filename}`;
    delete screenshot.content_type;
    screenshotCount += 1;
  }

  const stored: HostedReport = {
    ...payload,
    report_id: id,
    report_url: `/r/${id}`,
    share_url: `${origin}/r/${id}`,
    saved: true
  };

  const createdAt = stored.rendered_context?.captured_at || new Date().toISOString();
  const reportKey = `reports/${id}/report.json`;
  await env.REPORTS.put(reportKey, JSON.stringify(stored, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: { report_id: id, reviewed_url: String(stored.reviewed_url || "") }
  });

  if (env.DB) {
    await env.DB.prepare(`INSERT OR REPLACE INTO reports (id, reviewed_url, final_url, title, score, verdict, screenshot_count, created_at, report_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id,
        String(stored.reviewed_url || ""),
        String(stored.rendered_context?.final_url || ""),
        String(stored.rendered_context?.title || ""),
        Number.isFinite(stored.score) ? stored.score : null,
        String(stored.verdict || ""),
        screenshotCount,
        createdAt,
        reportKey
      )
      .run();
  }

  return stored;
}

async function reportScreenshotResponse(env: Env, id: string, filename: string): Promise<Response> {
  if (!env.REPORTS || !/^[a-z0-9-]{8,64}$/i.test(id) || !/^[a-z0-9._-]+$/i.test(filename)) {
    return json({ error: "not_found" }, 404);
  }
  const object = await env.REPORTS.get(`reports/${id}/screenshots/${filename}`);
  if (!object) return json({ error: "not_found" }, 404);
  const headers = new Headers({ "cache-control": "public, max-age=31536000, immutable" });
  if (object.writeHttpMetadata) object.writeHttpMetadata(headers);
  if (!headers.has("content-type")) headers.set("content-type", object.httpMetadata?.contentType || "image/png");
  return new Response(object.body, { headers });
}

function renderReportHtml(report: HostedReport): string {
  const screenshots = report.rendered_context?.screenshots || [];
  const issueItems = Array.isArray(report.top_issues)
    ? (report.top_issues as Array<Record<string, unknown>>).slice(0, 6).map((issue) => `<li><strong>${escapeHtml(issue.severity)} ${escapeHtml(issue.category)}</strong><span>${escapeHtml(issue.evidence)}</span></li>`).join("")
    : "";
  const images = screenshots.map((screenshot) => `<figure><img class="zoomable" src="${escapeHtml(screenshot.screenshot_url || screenshot.path)}" alt="${escapeHtml(screenshot.name || "UXRay screenshot")}" loading="lazy" /><figcaption>${escapeHtml(screenshot.name || "viewport")}</figcaption></figure>`).join("");
  const title = report.rendered_context?.title || "Saved UXRay report";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — UXRay report</title>
  <meta name="description" content="Saved UXRay hosted UI review report." />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <main class="container docs-shell report-shell">
    <a class="eyebrow-link" href="/">← UXRay</a>
    <p class="section-kicker">Saved hosted report</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="lede">${escapeHtml(report.reviewed_url)}</p>
    <div class="stats-grid">
      <article><span>Score</span><strong>${escapeHtml(report.score)}</strong></article>
      <article><span>Verdict</span><strong>${escapeHtml(report.verdict)}</strong></article>
      <article><span>Screenshots</span><strong>${screenshots.length}</strong></article>
    </div>
    <section class="report-gallery">${images}</section>
    <section class="docs-card"><h2>Top issues</h2><ul class="report-issues">${issueItems || "<li>No issues saved.</li>"}</ul></section>
    <section class="docs-card"><h2>API</h2><pre><code>curl https://useuxray.com/v1/reports/${escapeHtml(report.report_id)}</code></pre></section>
  </main>
  <script src="/site.js"></script>
</body>
</html>`;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

async function proxyRenderRequest(request: Request, env: Env, origin: string): Promise<Response | null> {
  if (!env.RENDER_API_BASE) return null;

  const upstreamUrl = new URL("/v1/reviews/url", env.RENDER_API_BASE.replace(/\/$/, ""));
  const headers = new Headers({ "content-type": "application/json" });
  if (env.RENDER_API_TOKEN) headers.set("x-uxray-render-token", env.RENDER_API_TOKEN);

  const body = await readJson(request) as Record<string, unknown>;
  const upstream = await fetch(upstreamUrl.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, inline_screenshots: true })
  });

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: "render_worker_error", message: "Render worker returned non-JSON response." }, upstream.status || 502);
  }

  if (!upstream.ok) {
    return json(payload, upstream.status);
  }

  const persisted = await persistHostedReport(payload as HostedReport, env, origin);
  return json(persisted, upstream.status);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return json({ ok: true });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, service: "uxray-cloudflare", stage: "deployed-demo", hosted_rendering: Boolean(env.RENDER_API_BASE) });
    }

    if (url.pathname === "/v1/account/dashboard" && request.method === "GET") {
      return json(await accountDashboard(env));
    }

    const reportScreenshotMatch = url.pathname.match(/^\/v1\/reports\/([a-z0-9-]{8,64})\/screenshots\/([a-z0-9._-]+)$/i);
    if (reportScreenshotMatch && (request.method === "GET" || request.method === "HEAD")) {
      return reportScreenshotResponse(env, reportScreenshotMatch[1], reportScreenshotMatch[2]);
    }

    const reportApiMatch = url.pathname.match(/^\/v1\/reports\/([a-z0-9-]{8,64})$/i);
    if (reportApiMatch && request.method === "GET") {
      const report = await loadReport(env, reportApiMatch[1]);
      return report ? json(report) : json({ error: "not_found", message: "Report not found." }, 404);
    }

    const reportPageMatch = url.pathname.match(/^\/r\/([a-z0-9-]{8,64})$/i);
    if (reportPageMatch && request.method === "GET") {
      const report = await loadReport(env, reportPageMatch[1]);
      return report ? html(renderReportHtml(report)) : html("<!doctype html><title>Report not found — UXRay</title><main class=\"container docs-shell\"><h1>Report not found</h1><p>This UXRay report does not exist or was removed.</p><a href=\"/\">Back to UXRay</a></main>", 404);
    }

    if (url.pathname === "/v1/update" && request.method === "GET") {
      const currentVersion = url.searchParams.get("current") || "0.0.0";
      const updateAvailable = compareVersions(UXRAY_VERSION, currentVersion) > 0;
      return json({
        ok: true,
        product: "UXRay",
        channel: url.searchParams.get("channel") || "stable",
        current_version: currentVersion,
        latest_version: UXRAY_VERSION,
        update_available: updateAvailable,
        severity: updateAvailable ? "recommended" : "none",
        release_notes: [
          "Share and bookmark actions are now interactive.",
          "Bookmark prompts visitors to create an account or log in before saving reports.",
          "Share opens platform-specific options plus copy-link fallback.",
          "Local installs can run npm run check:update for upgrade/cancel flow."
        ],
        commands: {
          check: "npm run check:update",
          auto_upgrade: "npm run check:update -- --auto",
          upgrade: "npm run upgrade",
          cancel: "Dismiss the update prompt and keep the current local version."
        },
        docs: "/docs.html#updates",
        github: "https://github.com/codepawl/ui-reviewer"
      });
    }

    if (url.pathname === "/v1/demo/report" && request.method === "GET") {
      return json(demoReport);
    }

    if (url.pathname === "/v1/install" && request.method === "GET") {
      return json(installGuide);
    }

    if (url.pathname === "/v1/billing/creem/webhook" && request.method === "GET") {
      return json({ ok: true, provider: "creem", endpoint: "/v1/billing/creem/webhook", mode: "webhook-ready" });
    }

    if (url.pathname === "/v1/billing/creem/webhook" && request.method === "POST") {
      let event: unknown = null;
      try {
        event = await request.json();
      } catch {
        event = null;
      }
      const eventType = typeof event === "object" && event && "eventType" in event
        ? (event as { eventType?: unknown }).eventType
        : typeof event === "object" && event && "type" in event
          ? (event as { type?: unknown }).type
          : "unknown";
      return json({ ok: true, provider: "creem", received: true, event_type: eventType });
    }

    if (url.pathname === "/v1/billing/checkout" && (request.method === "GET" || request.method === "POST")) {
      let requestedPlan = url.searchParams.get("plan") || "pro";
      let email = url.searchParams.get("email");

      if (request.method === "POST") {
        try {
          const formData = await request.formData();
          requestedPlan = String(formData.get("plan") || formData.get("product") || requestedPlan);
          email = String(formData.get("email") || email || "") || null;
        } catch {
          try {
            const body = await request.json() as { plan?: string; product?: string; email?: string };
            requestedPlan = body.plan || body.product || requestedPlan;
            email = body.email || email;
          } catch {
            // Non-form/non-JSON POSTs can still use the query string.
          }
        }
      }

      const normalizedPlan = normalizePlan(requestedPlan);
      const checkoutSessionUrl = await createCreemCheckout(env, url.origin, normalizedPlan, email);
      if (checkoutSessionUrl) {
        return redirect(checkoutSessionUrl);
      }

      const checkoutUrl = new URL(creemCheckoutUrl(normalizedPlan));
      if (email) checkoutUrl.searchParams.set("email", email);
      return redirect(checkoutUrl.toString());
    }

    if ((url.pathname === "/v1/auth/login" || url.pathname === "/v1/auth/register") && request.method === "POST") {
      return json(
        {
          ok: false,
          status: "account_shell_only",
          message: "Account UI is present, but user auth and entitlement delivery are not wired yet. Creem checkout redirects through /v1/billing/checkout.",
          next: "/docs.html#plugins"
        },
        202
      );
    }

    if (url.pathname === "/v1/reviews/url" && request.method === "POST") {
      const proxied = await proxyRenderRequest(request, env, url.origin);
      if (proxied) return proxied;

      return json(
        {
          error: "hosted_url_rendering_not_enabled",
          message: "The deployed Cloudflare demo cannot run local Chrome/Playwright. Use the local MCP server's review_ui_url for rendered URL review, or submit before/after reports to /v1/reviews/diff.",
          local_command: "npm run demo:pipeline",
          demo_report: "/v1/demo/report"
        },
        501
      );
    }

    if (url.pathname === "/v1/reviews/diff" && request.method === "POST") {
      try {
        const body = (await readJson(request)) as { before?: unknown; after?: unknown; label?: string };
        if (!body.before || !body.after) {
          return json({ error: "missing_before_or_after", message: "Expected JSON body with before and after review reports." }, 400);
        }
        const diff = compareReviewReports(body.before as any, body.after as any);
        return json(body.label ? { ...diff, label: body.label } : diff);
      } catch (error) {
        return json({ error: "invalid_diff_request", message: error instanceof Error ? error.message : "Unknown error" }, 400);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
