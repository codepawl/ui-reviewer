CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reviewed_url TEXT NOT NULL,
  final_url TEXT,
  title TEXT,
  score INTEGER,
  verdict TEXT,
  screenshot_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  report_key TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS reports_reviewed_url_idx ON reports(reviewed_url);
