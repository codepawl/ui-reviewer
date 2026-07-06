#!/usr/bin/env node
const baseUrl = process.env.UXRAY_BASE_URL || "https://useuxray.com";
const suffix = Date.now().toString(36);
const email = process.env.UXRAY_SMOKE_EMAIL || `smoke+${suffix}@useuxray.test`;
const runHostedRender = process.env.UXRAY_ACCOUNT_SMOKE_HOSTED === "1";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function postForm(path, fields, extraHeaders = {}) {
  const body = new URLSearchParams(fields);
  return await fetch(`${baseUrl}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "UXRayAccountSmoke/1.0",
      ...extraHeaders
    },
    body
  });
}

const magicResponse = await postForm("/v1/auth/magic-link", { email, purpose: "login" });
assert(magicResponse.ok, `/v1/auth/magic-link returned ${magicResponse.status}`);
const magic = await magicResponse.json();
assert(magic.status === "magic_link_created", "magic link was not created");
assert(typeof magic.verify_url === "string", "missing verify_url");

const verify = await fetch(magic.verify_url, { redirect: "manual", headers: { "user-agent": "UXRayAccountSmoke/1.0" } });
assert(verify.status === 303, `/v1/auth/verify expected 303, got ${verify.status}`);
const verifyCookie = (verify.headers.get("set-cookie") || "").split(";")[0];
assert(verifyCookie.startsWith("uxray_session="), "verify did not set uxray_session cookie");

const session = await fetch(`${baseUrl}/v1/auth/session`, {
  headers: { cookie: verifyCookie, "user-agent": "UXRayAccountSmoke/1.0" }
}).then((response) => response.json());
assert(session.authenticated === true, "session should be authenticated");
assert(session.account?.email === email, "session email mismatch");
assert(session.account?.verified_at, "magic-link verify did not mark account verified");

const createKey = await postForm("/v1/account/api-keys", { label: "smoke key" }, { cookie: verifyCookie });
assert(createKey.status === 201, `/v1/account/api-keys expected 201, got ${createKey.status}`);
const keyPayload = await createKey.json();
assert(keyPayload.api_key?.startsWith("uxr_"), "missing one-time API key");

const keyList = await fetch(`${baseUrl}/v1/account/api-keys`, {
  headers: { cookie: verifyCookie, "user-agent": "UXRayAccountSmoke/1.0" }
}).then((response) => response.json());
assert((keyList.api_keys || []).some((key) => key.prefix === keyPayload.prefix), "created key prefix not listed");

const dashboard = await fetch(`${baseUrl}/v1/account/dashboard`, {
  headers: { authorization: `Bearer ${keyPayload.api_key}`, "user-agent": "UXRayAccountSmoke/1.0" }
}).then((response) => response.json());
assert(dashboard.status === "dashboard_account_scoped", `dashboard not account scoped: ${dashboard.status}`);
assert(dashboard.account?.email === email, "dashboard account email mismatch");
assert(dashboard.account?.auth_method === "api_key", "dashboard did not authenticate via API key");
assert(dashboard.usage?.entitlement_status === "active", "dashboard should expose active free entitlement");

const webhookEmail = `webhook+${suffix}@useuxray.test`;
const webhookResponse = await fetch(`${baseUrl}/v1/billing/creem/webhook`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "user-agent": "UXRayAccountSmoke/1.0"
  },
  body: JSON.stringify({
    id: `evt_${suffix}`,
    type: "checkout.completed",
    customer: { email: webhookEmail },
    metadata: { plan: "pro", product: "uxray" }
  })
});
const webhook = await webhookResponse.json();
assert([200, 401].includes(webhookResponse.status), `webhook returned ${webhookResponse.status}`);
assert(
  webhook.status === "recorded_unverified" || webhook.status === "signature_missing",
  "unsigned webhook should be recorded unverified or rejected when the secret is configured"
);
if (webhookResponse.status === 200) assert(webhook.account_email === webhookEmail, "webhook email mismatch");

let hosted = null;
if (runHostedRender) {
  const hostedResponse = await fetch(`${baseUrl}/v1/reviews/url`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${keyPayload.api_key}`,
      "user-agent": "UXRayAccountSmoke/1.0"
    },
    body: JSON.stringify({
      url: `${baseUrl}/demo-report.html`,
      goal: "Smoke account API-key hosted review credit enforcement",
      viewport: ["desktop"],
      strictness: "medium"
    })
  });
  assert(hostedResponse.ok, `API-key hosted review returned ${hostedResponse.status}`);
  hosted = await hostedResponse.json();
  assert(hosted.saved === true, "hosted review was not saved");
  assert(hosted.account_email === email, "hosted review was not attached to API-key account");
}

console.log(JSON.stringify({
  ok: true,
  base_url: baseUrl,
  email,
  verified: Boolean(session.account.verified_at),
  api_key_prefix: keyPayload.prefix,
  dashboard_status: dashboard.status,
  dashboard_plan: dashboard.usage?.plan,
  dashboard_auth_method: dashboard.account?.auth_method,
  webhook_status: webhook.status,
  webhook_signature_status: webhook.signature_status,
  hosted_report_id: hosted?.report_id || null
}, null, 2));
