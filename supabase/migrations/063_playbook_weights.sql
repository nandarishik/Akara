CREATE TABLE IF NOT EXISTS playbook_weights (
  playbook_key TEXT PRIMARY KEY,
  weight NUMERIC NOT NULL DEFAULT 1
);
INSERT INTO playbook_weights (playbook_key, weight) VALUES
  ('raise_price', 1), ('cut_waste', 1), ('promote_item', 1)
ON CONFLICT (playbook_key) DO NOTHING;
GRANT ALL ON playbook_weights TO service_role;
