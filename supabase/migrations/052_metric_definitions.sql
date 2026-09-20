CREATE TABLE IF NOT EXISTS metric_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  formula TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT ALL ON metric_definitions TO service_role;
