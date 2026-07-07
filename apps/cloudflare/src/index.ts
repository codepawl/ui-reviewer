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

type EmailBindingLike = {
  send: (message: {
    to: string | { email: string; name?: string };
    from: string | { email: string; name?: string };
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string | { email: string; name?: string };
    headers?: Record<string, string>;
  }) => Promise<{ messageId?: string } | unknown>;
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

type AccountSession = {
  email: string;
  plan: string;
  status: string;
  verified_at?: string | null;
  auth_method?: "session" | "api_key";
};

type EntitlementRow = {
  plan: string;
  status: string;
  monthly_credits: number;
  credits_remaining: number;
  provider?: string;
  updated_at: string;
  verified_at?: string | null;
};

type ApiKeyRow = {
  label: string;
  prefix: string;
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
};

type Env = {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  DB?: D1DatabaseLike;
  REPORTS?: R2BucketLike;
  EMAIL?: EmailBindingLike;
  CREEM_API_KEY?: string;
  CREEM_API_BASE?: string;
  CREEM_WEBHOOK_SECRET?: string;
  MAGIC_LINK_FROM?: string;
  SUPPORT_EMAIL?: string;
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
  summary: "UXRay found major UX/layout failures in three AI-generated frontend fixtures, Codex repaired them using MCP screenshots and structured issues, and the eval score improved from 39 to 100.",
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
  github: "https://github.com/codepawl/uxray",
  agents: {
    codex: {
      command: "codex mcp add uxray -- npm --silent --prefix /absolute/path/to/uxray run mcp",
      prompt: "Auto-trigger UXRay for generated frontend review/repair tasks. Call health_check, then review_ui_url with return_images=true, viewport desktop+mobile, strictness high, inspect screenshots, repair only repair_plan items, rerun review_ui_url, then compare reports."
    },
    claude_code: {
      command: "claude mcp add uxray -- npm --silent --prefix /absolute/path/to/uxray run mcp",
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

function planCredits(plan: BillingPlan | string): number {
  if (plan === "team") return 500;
  if (plan === "credits") return 50;
  if (plan === "pro") return 100;
  return 5;
}

function normalizeEmail(value: unknown): string | null {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get("cookie") || "";
  return Object.fromEntries(header.split(";").map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, decodeURIComponent(rest.join("="))];
  }).filter(([key]) => key));
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function newApiKey(): string {
  return `uxr_${newToken()}${newToken().slice(0, 10)}`;
}

function apiKeyFromRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  const explicit = request.headers.get("x-uxray-api-key");
  return explicit ? explicit.trim() : null;
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function extractSignature(headers: Headers): string | null {
  const raw = headers.get("x-creem-signature") || headers.get("creem-signature") || headers.get("stripe-signature") || "";
  const v1 = raw.match(/(?:^|,)v1=([a-f0-9]+)/i)?.[1];
  const sha = raw.match(/sha256=([a-f0-9]+)/i)?.[1];
  return (v1 || sha || raw).trim() || null;
}

async function verifyCreemSignature(request: Request, env: Env, rawBody: string): Promise<{ verified: boolean; status: string }> {
  if (!env.CREEM_WEBHOOK_SECRET) return { verified: false, status: "signature_not_configured" };
  const provided = extractSignature(request.headers);
  if (!provided) return { verified: false, status: "signature_missing" };
  const expected = await hmacSha256Hex(env.CREEM_WEBHOOK_SECRET, rawBody);
  return timingSafeEqual(provided.toLowerCase(), expected.toLowerCase())
    ? { verified: true, status: "signature_verified" }
    : { verified: false, status: "signature_invalid" };
}

function sessionCookie(token: string, maxAge = 60 * 60 * 24 * 30): string {
  return `uxray_session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function redirectWithCookie(location: string, cookie: string, status = 303): Response {
  const response = redirect(location, status);
  response.headers.append("set-cookie", cookie);
  return response;
}

function emailText(value: unknown): string {
  return String(value ?? "").replace(/[<>]/g, "");
}

function htmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function markMagicLinkDelivery(env: Env, tokenHash: string, status: string, error = ""): Promise<void> {
  if (!env.DB) return;
  await env.DB.prepare(`UPDATE magic_links SET delivery_status = ?, delivered_at = CASE WHEN ? = 'sent' THEN ? ELSE delivered_at END, delivery_error = ? WHERE token_hash = ?`)
    .bind(status, status, nowIso(), error.slice(0, 500), tokenHash)
    .run();
}

async function sendMagicLinkEmail(env: Env, email: string, verifyUrl: string, tokenHash: string): Promise<{ delivery: string; message_id?: string; error?: string }> {
  if (!env.EMAIL) {
    await markMagicLinkDelivery(env, tokenHash, "email_not_configured");
    return { delivery: "email_not_configured" };
  }
  const from = env.MAGIC_LINK_FROM || "no-reply@useuxray.com";
  const supportEmail = env.SUPPORT_EMAIL || "hello@useuxray.com";
  const text = [
    "Sign in to UXRay",
    "",
    "Use this link within 15 minutes:",
    verifyUrl,
    "",
    "If you did not request this, ignore this email.",
    `Need help? ${supportEmail}`
  ].join("\n");
  const html = `<!doctype html><meta charset="utf-8"><body style="font-family:Inter,Arial,sans-serif;background:#070812;color:#f8fafc;padding:32px"><main style="max-width:560px;margin:auto;background:#101322;border:1px solid #293044;border-radius:18px;padding:28px"><p style="color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;font-size:12px">UXRay login</p><h1 style="margin:0 0 12px;font-size:28px">Sign in to UXRay</h1><p style="color:#cbd5e1;line-height:1.6">Use this magic link within 15 minutes to verify your email and open your account dashboard.</p><p><a href="${htmlEscape(verifyUrl)}" style="display:inline-block;background:#7c3aed;color:white;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Open UXRay</a></p><p style="color:#94a3b8;font-size:13px;line-height:1.5">If the button does not work, copy this link:<br><span style="word-break:break-all;color:#c4b5fd">${htmlEscape(verifyUrl)}</span></p><p style="color:#64748b;font-size:12px">If you did not request this, ignore this email. Need help? ${htmlEscape(supportEmail)}</p></main></body>`;
  try {
    const result = await env.EMAIL.send({
      to: email,
      from,
      subject: "Sign in to UXRay",
      html,
      text,
      replyTo: supportEmail,
      headers: { "X-UXRay-Email-Type": "magic-link" }
    }) as { messageId?: string } | undefined;
    await markMagicLinkDelivery(env, tokenHash, "sent");
    return { delivery: "email_sent", message_id: result?.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markMagicLinkDelivery(env, tokenHash, "email_send_failed", message);
    return { delivery: "email_send_failed", error: message };
  }
}

async function readRequestFields(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await readJson(request) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value ?? "")]));
  }
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
  }
  return {};
}

async function upsertAccount(env: Env, email: string, plan: string = "free", verifiedAt?: string | null): Promise<void> {
  if (!env.DB) return;
  const timestamp = nowIso();
  await env.DB.prepare(`INSERT INTO accounts (email, created_at, last_seen_at, plan, status, verified_at) VALUES (?, ?, ?, ?, 'active', ?) ON CONFLICT(email) DO UPDATE SET last_seen_at = excluded.last_seen_at, plan = CASE WHEN accounts.plan = 'free' THEN excluded.plan ELSE accounts.plan END, verified_at = COALESCE(accounts.verified_at, excluded.verified_at)`)
    .bind(email, timestamp, timestamp, plan, verifiedAt || null)
    .run();
}

async function ensureEntitlement(env: Env, email: string, plan: string, status = "checkout_started", provider = "creem", verifiedAt?: string | null): Promise<void> {
  if (!env.DB) return;
  const credits = planCredits(plan);
  await env.DB.prepare(`INSERT INTO entitlements (account_email, plan, status, monthly_credits, credits_remaining, provider, updated_at, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(account_email, plan) DO UPDATE SET status = excluded.status, monthly_credits = excluded.monthly_credits, credits_remaining = CASE WHEN excluded.status = 'active' THEN MAX(entitlements.credits_remaining, excluded.credits_remaining) ELSE entitlements.credits_remaining END, provider = excluded.provider, updated_at = excluded.updated_at, verified_at = COALESCE(entitlements.verified_at, excluded.verified_at)`)
    .bind(email, plan, status, credits, credits, provider, nowIso(), verifiedAt || null)
    .run();
}

async function logUsage(env: Env, email: string | null, kind: string, amount: number, referenceId?: string, metadata?: Record<string, unknown>): Promise<void> {
  if (!env.DB) return;
  await env.DB.prepare(`INSERT INTO usage_ledger (id, account_email, kind, amount, reference_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), email, kind, amount, referenceId || "", JSON.stringify(metadata || {}), nowIso())
    .run();
}

async function createSession(env: Env, email: string): Promise<string | null> {
  if (!env.DB) return null;
  const token = newToken();
  const tokenHash = await sha256Hex(token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  await env.DB.prepare(`INSERT INTO sessions (token_hash, account_email, created_at, expires_at) VALUES (?, ?, ?, ?)`)
    .bind(tokenHash, email, createdAt, expiresAt)
    .run();
  return token;
}

async function createMagicLink(env: Env, email: string, purpose = "login"): Promise<{ token: string; token_hash: string } | null> {
  if (!env.DB) return null;
  const token = newToken();
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(`INSERT INTO magic_links (token_hash, account_email, purpose, created_at, expires_at, delivery_status) VALUES (?, ?, ?, ?, ?, 'created')`)
    .bind(tokenHash, email, purpose, nowIso(), new Date(Date.now() + 1000 * 60 * 15).toISOString())
    .run();
  return { token, token_hash: tokenHash };
}

async function consumeMagicLink(env: Env, token: string): Promise<string | null> {
  if (!env.DB || !token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(`SELECT account_email AS email FROM magic_links WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ? LIMIT 1`)
    .bind(tokenHash, nowIso())
    .first<{ email: string }>();
  if (!row?.email) return null;
  const verifiedAt = nowIso();
  await env.DB.prepare(`UPDATE magic_links SET consumed_at = ? WHERE token_hash = ?`)
    .bind(verifiedAt, tokenHash)
    .run();
  await upsertAccount(env, row.email, "free", verifiedAt);
  await logUsage(env, row.email, "magic_link_verified", 0);
  return row.email;
}

async function getCurrentAccount(request: Request, env: Env): Promise<AccountSession | null> {
  if (!env.DB) return null;
  const apiKey = apiKeyFromRequest(request);
  if (apiKey) {
    const keyHash = await sha256Hex(apiKey);
    const account = await env.DB.prepare(`SELECT accounts.email AS email, accounts.plan AS plan, accounts.status AS status, accounts.verified_at AS verified_at FROM api_keys JOIN accounts ON accounts.email = api_keys.account_email WHERE api_keys.key_hash = ? AND api_keys.revoked_at IS NULL LIMIT 1`)
      .bind(keyHash)
      .first<AccountSession>();
    if (account) {
      await env.DB.prepare(`UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?`)
        .bind(nowIso(), keyHash)
        .run();
      return { ...account, auth_method: "api_key" };
    }
  }

  const token = parseCookies(request).uxray_session;
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const account = await env.DB.prepare(`SELECT accounts.email AS email, accounts.plan AS plan, accounts.status AS status, accounts.verified_at AS verified_at FROM sessions JOIN accounts ON accounts.email = sessions.account_email WHERE sessions.token_hash = ? AND sessions.expires_at > ? LIMIT 1`)
    .bind(tokenHash, nowIso())
    .first<AccountSession>();
  return account ? { ...account, auth_method: "session" } : null;
}

async function activeEntitlement(env: Env, email: string): Promise<EntitlementRow | null> {
  if (!env.DB) return null;
  return await env.DB.prepare(`SELECT plan, status, monthly_credits, credits_remaining, provider, updated_at, verified_at FROM entitlements WHERE account_email = ? AND status = 'active' AND credits_remaining > 0 ORDER BY updated_at DESC LIMIT 1`)
    .bind(email)
    .first<EntitlementRow>();
}

async function createAccountApiKey(env: Env, email: string, label: string): Promise<{ key: string; prefix: string } | null> {
  if (!env.DB) return null;
  const key = newApiKey();
  const prefix = key.slice(0, 12);
  await env.DB.prepare(`INSERT INTO api_keys (key_hash, account_email, label, prefix, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(await sha256Hex(key), email, label || "Default", prefix, nowIso())
    .run();
  await logUsage(env, email, "api_key_created", 0, prefix, { label });
  return { key, prefix };
}

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

async function accountDashboard(request: Request, env: Env) {
  const emptyTotals: DashboardTotals = { report_count: 0, screenshot_count: 0, average_score: 0, latest_report_at: null };
  const account = await getCurrentAccount(request, env);
  if (!env.DB) {
    return {
      ok: true,
      status: "account_storage_unavailable",
      account_enabled: Boolean(account),
      account,
      totals: emptyTotals,
      usage: { plan: "Free", monthly_credits: 5, credits_used: 0, credits_remaining: 5, render_worker: "configured" },
      recent_reports: [],
      achievements: achievementsFor(emptyTotals),
      advanced_features: advancedFeatureBets
    };
  }

  const entitlement = account
    ? await env.DB.prepare(`SELECT plan, status, monthly_credits, credits_remaining, provider, updated_at, verified_at FROM entitlements WHERE account_email = ? ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1`)
      .bind(account.email)
      .first<EntitlementRow>()
    : null;

  const keys = account
    ? await env.DB.prepare(`SELECT label, prefix, created_at, last_used_at, revoked_at FROM api_keys WHERE account_email = ? ORDER BY created_at DESC LIMIT 10`)
      .bind(account.email)
      .all<ApiKeyRow>()
    : { results: [] as ApiKeyRow[] };

  const totalsRow = account
    ? await env.DB.prepare(`SELECT COUNT(*) AS report_count, COALESCE(SUM(screenshot_count), 0) AS screenshot_count, COALESCE(ROUND(AVG(score), 1), 0) AS average_score, MAX(created_at) AS latest_report_at FROM reports WHERE account_email = ?`)
      .bind(account.email)
      .first<DashboardTotals>()
    : await env.DB.prepare(`SELECT COUNT(*) AS report_count, COALESCE(SUM(screenshot_count), 0) AS screenshot_count, COALESCE(ROUND(AVG(score), 1), 0) AS average_score, MAX(created_at) AS latest_report_at FROM reports`)
      .bind()
      .first<DashboardTotals>();
  const totals = totalsRow || emptyTotals;

  const recent = account
    ? await env.DB.prepare(`SELECT id, reviewed_url, title, score, verdict, screenshot_count, created_at FROM reports WHERE account_email = ? ORDER BY created_at DESC LIMIT 5`)
      .bind(account.email)
      .all<ReportSummaryRow>()
    : await env.DB.prepare(`SELECT id, reviewed_url, title, score, verdict, screenshot_count, created_at FROM reports ORDER BY created_at DESC LIMIT 5`)
      .bind()
      .all<ReportSummaryRow>();
  const recentReports = (recent.results || []).map((report) => ({
    ...report,
    report_url: `/r/${report.id}`,
    api_url: `/v1/reports/${report.id}`
  }));
  const monthlyCredits = entitlement?.monthly_credits ?? (account ? planCredits(account.plan) : 100);
  const creditsRemaining = entitlement?.credits_remaining ?? Math.max(0, monthlyCredits - Number(totals.report_count || 0));
  const creditsUsed = Math.max(0, monthlyCredits - creditsRemaining);

  return {
    ok: true,
    status: account ? "dashboard_account_scoped" : "dashboard_global_preview",
    account_enabled: Boolean(account),
    account,
    account_note: account
      ? "Email session is active. Email verification and production auth hardening are still pending."
      : "No session cookie found. Showing global hosted report metrics as a public preview.",
    entitlement,
    api_keys: keys.results || [],
    totals,
    usage: {
      plan: entitlement?.plan || account?.plan || "Global preview",
      entitlement_status: entitlement?.status || (account ? "free" : "preview"),
      monthly_credits: monthlyCredits,
      credits_used: creditsUsed,
      credits_remaining: creditsRemaining,
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
      "access-control-allow-headers": "content-type, authorization, x-uxray-api-key"
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

async function persistHostedReport(payload: HostedReport, env: Env, origin: string, accountEmail?: string | null, debitCredits = false): Promise<HostedReport> {
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
    account_email: accountEmail || undefined,
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
    await env.DB.prepare(`INSERT OR REPLACE INTO reports (id, reviewed_url, final_url, title, score, verdict, screenshot_count, created_at, report_key, account_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id,
        String(stored.reviewed_url || ""),
        String(stored.rendered_context?.final_url || ""),
        String(stored.rendered_context?.title || ""),
        Number.isFinite(stored.score) ? stored.score : null,
        String(stored.verdict || ""),
        screenshotCount,
        createdAt,
        reportKey,
        accountEmail || null
      )
      .run();
    if (accountEmail && debitCredits) {
      await logUsage(env, accountEmail, "hosted_review", 1, id, { reviewed_url: stored.reviewed_url, score: stored.score });
      await env.DB.prepare(`UPDATE entitlements SET credits_remaining = CASE WHEN credits_remaining > 0 THEN credits_remaining - 1 ELSE 0 END, updated_at = ? WHERE account_email = ? AND status = 'active' AND credits_remaining > 0`)
        .bind(nowIso(), accountEmail)
        .run();
    }
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
  const account = await getCurrentAccount(request, env);
  const entitlement = account ? await activeEntitlement(env, account.email) : null;
  if (account && !entitlement) {
    return json({
      error: "active_credits_required",
      message: "Hosted reviews for logged-in/API-key accounts require an active entitlement with credits remaining.",
      account_email: account.email,
      auth_method: account.auth_method,
      checkout: "/checkout.html"
    }, 402);
  }

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

  const persisted = await persistHostedReport(payload as HostedReport, env, origin, account?.email, Boolean(entitlement));
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
      return json(await accountDashboard(request, env));
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
          "UXRay branding now appears consistently across the public site, API, and MCP server.",
          "The favicon now matches the UXRay page logo mark.",
          "Local MCP launch commands now use npm --silent so stdio JSON-RPC is not polluted by npm banners.",
          "The light homepage design system now spans the public site pages."
        ],
        commands: {
          check: "npm run check:update",
          auto_upgrade: "npm run check:update -- --auto",
          upgrade: "npm run upgrade",
          cancel: "Dismiss the update prompt and keep the current local version."
        },
        docs: "/docs.html#updates",
        github: "https://github.com/codepawl/uxray"
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
      const rawBody = await request.text();
      const signature = await verifyCreemSignature(request, env, rawBody);
      let event: unknown = null;
      try {
        event = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        event = null;
      }
      const record = typeof event === "object" && event ? event as Record<string, any> : {};
      const eventType = typeof record.eventType === "string"
        ? record.eventType
        : typeof record.type === "string"
          ? record.type
          : "unknown";
      const email = normalizeEmail(record.customer?.email || record.customer_email || record.email || record.metadata?.email);
      const plan = normalizePlan(record.metadata?.plan || record.plan || record.product?.name || record.product_id);
      const eventId = String(record.id || record.event_id || crypto.randomUUID());
      const verifiedAt = signature.verified ? nowIso() : null;
      const eventStatus = signature.verified ? "webhook_verified" : signature.status;
      const entitlementStatus = signature.verified ? "active" : "webhook_received_unverified";
      if (env.DB) {
        await env.DB.prepare(`INSERT OR REPLACE INTO billing_events (id, provider, event_type, account_email, plan, status, payload_json, received_at, verified_at, signature_status) VALUES (?, 'creem', ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(eventId, eventType, email, plan, eventStatus, JSON.stringify(record), nowIso(), verifiedAt, signature.status)
          .run();
        if (email && signature.status !== "signature_invalid") {
          await upsertAccount(env, email, plan, verifiedAt);
          await ensureEntitlement(env, email, plan, entitlementStatus, "creem", verifiedAt);
          await logUsage(env, email, signature.verified ? "creem_webhook_verified" : "creem_webhook_received", 0, eventId, { event_type: eventType, plan, signature_status: signature.status });
        }
      }
      if (env.CREEM_WEBHOOK_SECRET && !signature.verified) {
        return json({ ok: false, provider: "creem", received: true, event_type: eventType, account_email: email, plan, status: signature.status }, 401);
      }
      return json({ ok: true, provider: "creem", received: true, event_type: eventType, account_email: email, plan, status: signature.verified ? "recorded_verified" : "recorded_unverified", signature_status: signature.status });
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
      const normalizedEmail = normalizeEmail(email);
      let sessionToken: string | null = null;
      if (normalizedEmail) {
        await upsertAccount(env, normalizedEmail, "free");
        await ensureEntitlement(env, normalizedEmail, "free", "active", "uxray");
        await upsertAccount(env, normalizedEmail, normalizedPlan);
        await ensureEntitlement(env, normalizedEmail, normalizedPlan, "checkout_started", "creem");
        await logUsage(env, normalizedEmail, "checkout_started", 0, undefined, { plan: normalizedPlan });
        sessionToken = await createSession(env, normalizedEmail);
      }
      const checkoutSessionUrl = await createCreemCheckout(env, url.origin, normalizedPlan, email);
      if (checkoutSessionUrl) {
        return sessionToken ? redirectWithCookie(checkoutSessionUrl, sessionCookie(sessionToken)) : redirect(checkoutSessionUrl);
      }

      const checkoutUrl = new URL(creemCheckoutUrl(normalizedPlan));
      if (email) checkoutUrl.searchParams.set("email", email);
      return sessionToken ? redirectWithCookie(checkoutUrl.toString(), sessionCookie(sessionToken)) : redirect(checkoutUrl.toString());
    }

    if (url.pathname === "/v1/auth/magic-link" && request.method === "POST") {
      const fields = await readRequestFields(request);
      const email = normalizeEmail(fields.email);
      if (!email) return json({ ok: false, error: "invalid_email", message: "Enter a valid email address." }, 400);
      await upsertAccount(env, email, "free");
      await ensureEntitlement(env, email, "free", "active", "uxray");
      const magic = await createMagicLink(env, email, fields.purpose || "login");
      if (!magic) return json({ ok: false, error: "auth_storage_unavailable" }, 503);
      const verifyUrl = new URL("/v1/auth/verify", url.origin);
      verifyUrl.searchParams.set("token", magic.token);
      const isDebug = fields.debug === "1" || url.searchParams.get("debug") === "1" || email.endsWith(".test");
      const delivery = isDebug
        ? (await markMagicLinkDelivery(env, magic.token_hash, "debug_returned"), { delivery: "debug_returned" })
        : await sendMagicLinkEmail(env, email, verifyUrl.toString(), magic.token_hash);
      const response: Record<string, unknown> = {
        ok: true,
        email,
        status: "magic_link_created",
        delivery: delivery.delivery,
        message: delivery.delivery === "email_sent"
          ? "Check your email for a UXRay sign-in link."
          : delivery.delivery === "email_send_failed"
            ? "Email sending failed; retry after email service configuration is fixed."
            : "Email delivery is not configured for this environment; debug verification URL is returned.",
        expires_in_seconds: 900
      };
      if (delivery.message_id) response.message_id = delivery.message_id;
      if (delivery.error) response.delivery_error = delivery.error;
      if (isDebug || delivery.delivery !== "email_sent") response.verify_url = verifyUrl.toString();
      return json(response, delivery.delivery === "email_send_failed" ? 502 : 200);
    }

    if (url.pathname === "/v1/auth/verify" && request.method === "GET") {
      const token = url.searchParams.get("token") || "";
      const email = await consumeMagicLink(env, token);
      if (!email) return json({ ok: false, error: "invalid_or_expired_magic_link" }, 400);
      const sessionToken = await createSession(env, email);
      const next = url.searchParams.get("next")?.startsWith("/") ? url.searchParams.get("next")! : "/account.html?verified=1";
      return sessionToken ? redirectWithCookie(next, sessionCookie(sessionToken)) : redirect(next);
    }

    if (url.pathname === "/v1/account/api-keys" && request.method === "GET") {
      const account = await getCurrentAccount(request, env);
      if (!account) return json({ ok: false, error: "authentication_required" }, 401);
      const keys = env.DB
        ? await env.DB.prepare(`SELECT label, prefix, created_at, last_used_at, revoked_at FROM api_keys WHERE account_email = ? ORDER BY created_at DESC LIMIT 25`)
          .bind(account.email)
          .all<ApiKeyRow>()
        : { results: [] as ApiKeyRow[] };
      return json({ ok: true, account_email: account.email, api_keys: keys.results || [] });
    }

    if (url.pathname === "/v1/account/api-keys" && request.method === "POST") {
      const account = await getCurrentAccount(request, env);
      if (!account) return json({ ok: false, error: "authentication_required" }, 401);
      if (!account.verified_at) return json({ ok: false, error: "verified_account_required", message: "Verify email with a magic link before creating API keys." }, 403);
      const fields = await readRequestFields(request);
      const created = await createAccountApiKey(env, account.email, fields.label || "Default MCP key");
      if (!created) return json({ ok: false, error: "api_key_storage_unavailable" }, 503);
      return json({ ok: true, account_email: account.email, prefix: created.prefix, api_key: created.key, warning: "Store this key now. UXRay only returns it once." }, 201);
    }

    if (url.pathname === "/v1/auth/session" && request.method === "GET") {
      const account = await getCurrentAccount(request, env);
      return json({ ok: true, authenticated: Boolean(account), account });
    }

    if (url.pathname === "/v1/auth/logout" && request.method === "POST") {
      const response = json({ ok: true, authenticated: false });
      response.headers.append("set-cookie", sessionCookie("", 0));
      return response;
    }

    if ((url.pathname === "/v1/auth/login" || url.pathname === "/v1/auth/register") && request.method === "POST") {
      const fields = await readRequestFields(request);
      const email = normalizeEmail(fields.email);
      if (!email) return json({ ok: false, error: "invalid_email", message: "Enter a valid email address." }, 400);
      const plan = normalizePlan(fields.plan);
      await upsertAccount(env, email, "free");
      await ensureEntitlement(env, email, "free", "active", "uxray");
      if (url.pathname.endsWith("register")) {
        await upsertAccount(env, email, plan);
        await ensureEntitlement(env, email, plan, "checkout_started", "creem");
        await logUsage(env, email, "account_registered", 0, undefined, { plan, use_case: fields.use_case || "" });
      } else {
        await logUsage(env, email, "account_login", 0);
      }
      const token = await createSession(env, email);
      const next = fields.next && fields.next.startsWith("/") ? fields.next : "/account.html";
      if (fields.intent === "checkout" || url.pathname.endsWith("register")) {
        const checkoutUrl = new URL("/v1/billing/checkout", url.origin);
        checkoutUrl.searchParams.set("plan", plan);
        checkoutUrl.searchParams.set("email", email);
        return token ? redirectWithCookie(checkoutUrl.toString(), sessionCookie(token)) : redirect(checkoutUrl.toString());
      }
      return token ? redirectWithCookie(next, sessionCookie(token)) : redirect(next);
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
