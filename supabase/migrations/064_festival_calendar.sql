CREATE TABLE IF NOT EXISTS festival_calendar (
  festival_date DATE PRIMARY KEY,
  name TEXT NOT NULL
);
INSERT INTO festival_calendar (festival_date, name) VALUES
  ('2026-10-20', 'Diwali'), ('2027-10-08', 'Diwali')
ON CONFLICT (festival_date) DO NOTHING;
GRANT ALL ON festival_calendar TO service_role;
