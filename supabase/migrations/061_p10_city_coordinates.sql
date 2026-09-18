CREATE TABLE IF NOT EXISTS city_coordinates (
  city TEXT PRIMARY KEY,
  lat NUMERIC,
  lon NUMERIC
);
INSERT INTO city_coordinates (city, lat, lon) VALUES
  ('Bengaluru', 12.97, 77.59),
  ('Mumbai', 19.07, 72.87)
ON CONFLICT (city) DO NOTHING;
CREATE TABLE IF NOT EXISTS tenant_profiles (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  city TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  alert_prefs JSONB
);
