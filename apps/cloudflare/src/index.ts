import { compareReviewReports } from "../../../packages/reviewer-core/src/index.js";

type Env = {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  CREEM_API_KEY?: string;
  CREEM_API_BASE?: string;
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
      prompt: "Call health_check, then review_ui_url with return_images=true, inspect screenshots, repair the UI, rerun review_ui_url, then compare reports."
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
      purpose: "Teaches agents the review -> repair -> diff loop and prevents vague UI beautification."
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

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return json({ ok: true });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, service: "uxray-cloudflare", stage: "deployed-demo" });
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
