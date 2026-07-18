-- FIX #2 — Rate limits server-side (D1)
-- OWASP A04 — Insecure Design

CREATE TABLE IF NOT EXISTS rate_limits (
  action TEXT NOT NULL,
  user_id TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (action, user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON rate_limits (action, user_id, window_start);
