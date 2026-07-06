CREATE TABLE IF NOT EXISTS accounts (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (account_email) REFERENCES accounts(email)
);

CREATE TABLE IF NOT EXISTS entitlements (
  account_email TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (account_email, plan),
  FOREIGN KEY (account_email) REFERENCES accounts(email)
);

CREATE TABLE IF NOT EXISTS usage_ledger (
  id TEXT PRIMARY KEY,
  account_email TEXT,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reference_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (account_email) REFERENCES accounts(email)
);

CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  account_email TEXT,
  plan TEXT,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL
);

ALTER TABLE reports ADD COLUMN account_email TEXT;

CREATE INDEX IF NOT EXISTS idx_reports_account_created ON reports(account_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_email);
CREATE INDEX IF NOT EXISTS idx_entitlements_account ON entitlements(account_email);
CREATE INDEX IF NOT EXISTS idx_usage_account_created ON usage_ledger(account_email, created_at DESC);
