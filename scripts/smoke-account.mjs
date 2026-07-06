#!/usr/bin/env node
const baseUrl = process.env.UXRAY_BASE_URL || "https://useuxray.com";
const suffix = Date.now().toString(36);
const email = process.env.UXRAY_SMOKE_EMAIL || `smoke+${suffix}@useuxray.test`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function postForm(path, fields) {
  const body = new URLSearchParams(fields);
  return await fetch(`${baseUrl}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "UXRayAccountSmoke/1.0"
    },
    body
  });
}

const login = await postForm("/v1/auth/login", { email, next: "/account.html" });
assert(login.status === 303, `/v1/auth/login expected 303, got ${login.status}`);
const setCookie = login.headers.get("set-cookie") || "";
const cookie = setCookie.split(";")[0];
assert(cookie.startsWith("uxray_session="), "login did not set uxray_session cookie");

const session = await fetch(`${baseUrl}/v1/auth/session`, {
  headers: { cookie, "user-agent": "UXRayAccountSmoke/1.0" }
}).then((response) => response.json());
assert(session.authenticated === true, "session should be authenticated");
assert(session.account?.email === email, "session email mismatch");

const dashboard = await fetch(`${baseUrl}/v1/account/dashboard`, {
  headers: { cookie, "user-agent": "UXRayAccountSmoke/1.0" }
}).then((response) => response.json());
assert(dashboard.status === "dashboard_account_scoped", `dashboard not account scoped: ${dashboard.status}`);
assert(dashboard.account?.email === email, "dashboard account email mismatch");

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
assert(webhookResponse.ok, `webhook returned ${webhookResponse.status}`);
const webhook = await webhookResponse.json();
assert(webhook.status === "recorded_unverified", "webhook was not recorded");
assert(webhook.account_email === webhookEmail, "webhook email mismatch");

console.log(JSON.stringify({
  ok: true,
  base_url: baseUrl,
  login_status: login.status,
  session_email: session.account.email,
  dashboard_status: dashboard.status,
  dashboard_plan: dashboard.usage?.plan,
  webhook_status: webhook.status,
  webhook_email: webhook.account_email
}, null, 2));
