CREATE TABLE IF NOT EXISTS copilot_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id TEXT NOT NULL,
  passed BOOLEAN,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT ALL ON copilot_evaluations TO service_role;
