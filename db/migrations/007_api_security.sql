CREATE TABLE api_rate_limits (
  key_hash char(64) PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts > 0),
  resets_at timestamptz NOT NULL
);

CREATE INDEX api_rate_limits_expiry_idx ON api_rate_limits (resets_at);
