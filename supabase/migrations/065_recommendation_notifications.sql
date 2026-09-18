CREATE TABLE IF NOT EXISTS recommendation_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE CASCADE,
  channel TEXT,
  sent_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT ALL ON recommendation_notifications TO service_role;
