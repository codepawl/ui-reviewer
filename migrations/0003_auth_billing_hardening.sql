CREATE TABLE IF NOT EXISTS magic_links (
  token_hash TEXT PRIMARY KEY,
  account_email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  FOREIGN KEY (account_email) REFERENCES accounts(email)
);

CREATE TABLE IF NOT EXISTS api_keys (
  key_hash TEXT PRIMARY KEY,
  account_email TEXT NOT NULL,
  label TEXT NOT NULL,
  prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (account_email) REFERENCES accounts(email)
);

ALTER TABLE accounts ADD COLUMN verified_at TEXT;
ALTER TABLE entitlements ADD COLUMN verified_at TEXT;
ALTER TABLE billing_events ADD COLUMN verified_at TEXT;
ALTER TABLE billing_events ADD COLUMN signature_status TEXT;

CREATE INDEX IF NOT EXISTS idx_magic_links_account ON magic_links(account_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_account ON api_keys(account_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(prefix);
