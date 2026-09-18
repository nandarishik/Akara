CREATE TABLE IF NOT EXISTS connector_checkpoints (
  connector_id UUID PRIMARY KEY REFERENCES connectors(id) ON DELETE CASCADE,
  cursor TEXT,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT ALL ON connector_checkpoints TO service_role;
